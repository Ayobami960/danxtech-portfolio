import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../../database/clients.js";
import { accounts, agency_earning, agency_metadata, client_metadata, client_spents, contract_milestones, contracts, conversation_participants, freelancer_earning, freelancer_metadata, job_posts, messages, proposals, reviews, } from "../../database/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { redis } from "../../config/redis.js";
import { env } from "../../config/env.js";
import { stripe } from "../../config/stripe.js";
import { ACCOUNT_AUTH_CACHE_TTL_SECONDS, getAccountAuthCacheKey } from "../../config/constants.js";
export const getClientProfile = async (userId) => {
    const [profile] = await db.select({
        firstName: client_metadata.first_name,
        lastName: client_metadata.last_name,
        country: client_metadata.country,
        avatarUrl: client_metadata.avatar_url,
        accountFirstName: accounts.first_name,
        accountLastName: accounts.last_name,
        accountCountry: accounts.country,
        professionalRole: client_metadata.role,
        companyName: client_metadata.company_name,
        companyWebsite: client_metadata.company_website,
        companySize: client_metadata.company_size,
        industry: client_metadata.industry,
        companyDescription: client_metadata.company_description,
        joinedAt: client_metadata.created_at,
        accountJoinedAt: accounts.created_at,
        identityVerified: accounts.identityVerified,
        paymentMethodVerified: accounts.paymentMethodVerified
    })
        .from(accounts)
        .leftJoin(client_metadata, eq(accounts.auth_id, client_metadata.auth_id))
        .where(and(eq(accounts.auth_id, userId), eq(accounts.role, "CLIENT")))
        .limit(1);
    if (!profile)
        return null;
    return {
        firstName: profile.firstName ?? profile.accountFirstName ?? "",
        lastName: profile.lastName ?? profile.accountLastName ?? "",
        country: profile.country ?? profile.accountCountry ?? "",
        avatarUrl: profile.avatarUrl ?? "",
        professionalRole: profile.professionalRole ?? "",
        companyName: profile.companyName ?? "",
        companyWebsite: profile.companyWebsite ?? "",
        companySize: profile.companySize ?? "",
        industry: profile.industry ?? "",
        companyDescription: profile.companyDescription ?? "",
        joinedAt: profile.joinedAt ?? profile.accountJoinedAt,
        identityVerified: profile.identityVerified === true,
        paymentMethodVerified: profile.paymentMethodVerified === true
    };
};
export const saveClientProfile = async (input) => {
    const now = new Date();
    const profile = await db.transaction(async (transaction) => {
        const [account] = await transaction.update(accounts).set({
            first_name: input.firstName,
            last_name: input.lastName,
            country: input.country,
            isOnboardingComplete: true,
            updated_at: now
        })
            .where(and(eq(accounts.auth_id, input.userId), eq(accounts.role, "CLIENT"))).returning({
            id: accounts.id,
            identityVerified: accounts.identityVerified,
            paymentMethodVerified: accounts.paymentMethodVerified
        });
        if (!account) {
            throw new ApiError(404, "Client account not found.");
        }
        const profileValues = {
            first_name: input.firstName,
            last_name: input.lastName,
            country: input.country,
            avatar_url: input.avatarUrl || null,
            role: input.professionalRole,
            company_name: input.companyName,
            company_website: input.companyWebsite,
            company_size: input.companySize,
            industry: input.industry,
            company_description: input.companyDescription,
        };
        const returningProfile = {
            firstName: client_metadata.first_name,
            lastName: client_metadata.last_name,
            country: client_metadata.country,
            avatarUrl: client_metadata.avatar_url,
            professionalRole: client_metadata.role,
            companyName: client_metadata.company_name,
            companyWebsite: client_metadata.company_website,
            companySize: client_metadata.company_size,
            industry: client_metadata.industry,
            companyDescription: client_metadata.company_description,
            joinedAt: client_metadata.created_at,
        };
        const [existingProfile] = await transaction.select({ id: client_metadata.id })
            .from(client_metadata)
            .where(eq(client_metadata.auth_id, input.userId))
            .limit(1);
        const [savedProfile] = existingProfile
            ? await transaction.update(client_metadata)
                .set({ ...profileValues, updated_at: now })
                .where(eq(client_metadata.id, existingProfile.id))
                .returning(returningProfile)
            : await transaction.insert(client_metadata)
                .values({ ...profileValues, auth_id: input.userId, created_at: now, updated_at: now })
                .returning(returningProfile);
        if (!savedProfile) {
            throw new ApiError(500, "Client profile could not be saved");
        }
        return {
            ...savedProfile,
            firstName: savedProfile.firstName ?? input.firstName,
            lastName: savedProfile.lastName ?? input.lastName,
            country: savedProfile.country ?? input.country,
            avatarUrl: savedProfile.avatarUrl ?? "",
            identityVerified: account.identityVerified === true,
            paymentMethodVerified: account.paymentMethodVerified === true,
        };
    });
    // Best-effort cache refresh: a Redis outage must not fail a committed save.
    if (redis.isReady) {
        try {
            await redis.setEx(getAccountAuthCacheKey(input.userId, "client"), ACCOUNT_AUTH_CACHE_TTL_SECONDS, JSON.stringify({
                userId: input.userId,
                role: "client",
                accountExists: true,
                isOnboarded: true,
                emailVerified: true,
            }));
        }
        catch (error) {
            console.warn("Client auth cache could not be refreshed after profile save.", error);
        }
    }
    return {
        ...profile,
        isOnboarded: true
    };
};
export const getClientHiringOverview = async (clientId) => {
    const [spend] = await db
        .select({
        totalSpent: client_spents.total_spent,
        completedContracts: client_spents.completed_contracts,
        ongoingContracts: client_spents.ongoing_contracts,
        rating: client_spents.rating,
    })
        .from(client_spents)
        .where(eq(client_spents.client_id, clientId))
        .limit(1);
    const [openJobsRow] = await db
        .select({ value: count() })
        .from(job_posts)
        .where(and(eq(job_posts.client_id, clientId), eq(job_posts.status, "PUBLISHED")));
    const [totalJobsRow] = await db
        .select({ value: count() })
        .from(job_posts)
        .where(eq(job_posts.client_id, clientId));
    const responseResult = await db.execute(sql `
    with client_messages as (
      select
        m.sender_id,
        m.created_at,
        lag(m.sender_id) over (partition by m.conversation_id order by m.created_at) as prev_sender_id,
        lag(m.created_at) over (partition by m.conversation_id order by m.created_at) as prev_created_at
      from ${messages} m
      where m.message_type = 'USER'
        and m.conversation_id in (
          select conversation_id from ${conversation_participants}
          where account_id = ${clientId}
        )
    )
    select avg(extract(epoch from (created_at - prev_created_at))) as avg_seconds
    from client_messages
    where sender_id = ${clientId}
      and prev_sender_id is not null
      and prev_sender_id <> ${clientId}
  `);
    const averageResponseSeconds = responseResult.rows[0]?.avg_seconds ?? null;
    const totalHires = (spend?.completedContracts ?? 0) + (spend?.ongoingContracts ?? 0);
    const totalJobs = totalJobsRow?.value ?? 0;
    return {
        totalSpent: Number(spend?.totalSpent ?? 0),
        completedContracts: spend?.completedContracts ?? 0,
        rating: Number(spend?.rating ?? 0),
        openJobs: openJobsRow?.value ?? 0,
        totalHires,
        hireRate: totalJobs > 0
            ? Math.min(100, Math.round((totalHires / totalJobs) * 100))
            : 0,
        averageResponseDays: averageResponseSeconds != null
            ? Number(averageResponseSeconds) / 86400
            : null,
    };
};
export const getClientDashboardOverview = async (clientId) => {
    const [spend] = await db
        .select({
        totalSpent: client_spents.total_spent,
        ongoingContracts: client_spents.ongoing_contracts,
        completedContracts: client_spents.completed_contracts,
    })
        .from(client_spents)
        .where(eq(client_spents.client_id, clientId))
        .limit(1);
    const [openJobsRow] = await db
        .select({ value: count() })
        .from(job_posts)
        .where(and(eq(job_posts.client_id, clientId), eq(job_posts.status, "PUBLISHED")));
    const [proposalStats] = await db
        .select({
        total: count(),
        submitted: sql `count(*) filter (where ${proposals.status} = 'SUBMITTED')`,
        // Shortlisting only changes `is_shortlisted`; the status may already be
        // SHORTLISTED (or later), so filter on the flag alone.
        shortlisted: sql `count(*) filter (where ${proposals.is_shortlisted})`,
    })
        .from(proposals)
        .innerJoin(job_posts, eq(proposals.job_id, job_posts.id))
        .where(eq(job_posts.client_id, clientId));
    const contractRows = await db
        .select({
        id: contracts.id,
        title: contracts.title,
        totalAmount: contracts.total_amount,
        completedAmount: sql `coalesce(sum(${contract_milestones.amount}) filter (where ${contract_milestones.status} = 'COMPLETED'), 0)`,
        fundedAmount: sql `coalesce(sum(${contract_milestones.amount}) filter (where ${contract_milestones.funded_at} is not null and ${contract_milestones.status} <> 'COMPLETED'), 0)`,
    })
        .from(contracts)
        .innerJoin(contract_milestones, eq(contract_milestones.contract_id, contracts.id))
        .where(and(eq(contracts.client_id, clientId), eq(contracts.status, "ACTIVE")))
        .groupBy(contracts.id, contracts.title, contracts.total_amount);
    const activeJobRows = await db
        .select({
        id: job_posts.id,
        title: job_posts.title,
        budget: job_posts.total_budget,
        level: job_posts.expertise_level,
        duration: job_posts.expected_duration,
        proposalCount: count(proposals.id),
    })
        .from(job_posts)
        .leftJoin(proposals, eq(proposals.job_id, job_posts.id))
        .where(and(eq(job_posts.client_id, clientId), eq(job_posts.status, "PUBLISHED")))
        .groupBy(job_posts.id)
        .orderBy(desc(job_posts.created_at))
        .limit(5);
    const currentlyFunded = contractRows.reduce((sum, row) => sum + Number(row.fundedAmount), 0);
    return {
        openJobs: openJobsRow?.value ?? 0,
        totalProposals: proposalStats?.total ?? 0,
        newProposals: Number(proposalStats?.submitted ?? 0),
        shortlistedProposals: Number(proposalStats?.shortlisted ?? 0),
        activeContracts: spend?.ongoingContracts ?? 0,
        totalContracts: (spend?.ongoingContracts ?? 0) + (spend?.completedContracts ?? 0),
        totalSpent: Number(spend?.totalSpent ?? 0),
        currentlyFunded,
        inProgressContracts: contractRows.map((row) => ({
            id: row.id,
            title: row.title,
            progressPercent: Number(row.totalAmount) > 0
                ? Math.round((Number(row.completedAmount) / Number(row.totalAmount)) * 100)
                : 0,
        })),
        activeJobPosts: activeJobRows.map((row) => ({
            id: row.id,
            title: row.title,
            budget: Number(row.budget),
            level: row.level,
            duration: row.duration,
            proposalCount: row.proposalCount,
        })),
    };
};
export const getClientCompletedContracts = async (clientId) => {
    const rows = await db
        .select({
        id: contracts.id,
        title: contracts.title,
        totalAmount: contracts.total_amount,
        completedAt: contracts.completed_at,
        freelancerId: contracts.freelancer_id,
        agencyId: contracts.agency_id,
    })
        .from(contracts)
        .where(and(eq(contracts.client_id, clientId), eq(contracts.status, "COMPLETED")))
        .orderBy(desc(contracts.completed_at));
    if (rows.length === 0)
        return [];
    const contractIds = rows.map((row) => row.id);
    const reviewRows = await db
        .select({
        contractId: reviews.contract_id,
        reviewerId: reviews.reviewer_id,
        rating: reviews.rating,
        comment: reviews.comment,
    })
        .from(reviews)
        .where(inArray(reviews.contract_id, contractIds));
    const reviewsByContract = new Map();
    for (const review of reviewRows) {
        const list = reviewsByContract.get(review.contractId) ?? [];
        list.push(review);
        reviewsByContract.set(review.contractId, list);
    }
    const freelancerIds = [
        ...new Set(rows.map((row) => row.freelancerId).filter((id) => Boolean(id))),
    ];
    const names = new Map();
    if (freelancerIds.length) {
        const freelancerRows = await db
            .select({
            authId: accounts.auth_id,
            firstName: accounts.first_name,
            lastName: accounts.last_name,
        })
            .from(accounts)
            .where(inArray(accounts.auth_id, freelancerIds));
        freelancerRows.forEach((row) => {
            names.set(row.authId, [row.firstName, row.lastName].filter(Boolean).join(" ") ||
                "Marketplace user");
        });
    }
    const agencyIds = [
        ...new Set(rows.map((row) => row.agencyId).filter((id) => Boolean(id))),
    ];
    const agencyNames = new Map();
    if (agencyIds.length) {
        const agencyRows = await db
            .select({ id: agency_metadata.id, name: agency_metadata.name })
            .from(agency_metadata)
            .where(inArray(agency_metadata.id, agencyIds));
        agencyRows.forEach((row) => agencyNames.set(row.id, row.name ?? "Agency"));
    }
    return rows.map((row) => {
        const contractReviews = reviewsByContract.get(row.id) ?? [];
        const clientReviewRow = contractReviews.find((review) => review.reviewerId === clientId);
        const talentReviewRow = contractReviews.find((review) => review.reviewerId !== clientId);
        const talentName = row.freelancerId
            ? names.get(row.freelancerId) ?? "Marketplace user"
            : row.agencyId
                ? agencyNames.get(row.agencyId) ?? "Agency"
                : "Marketplace user";
        return {
            id: row.id,
            title: row.title,
            talent: talentName,
            budget: Number(row.totalAmount),
            completedAt: row.completedAt ? row.completedAt.toISOString() : null,
            clientReview: clientReviewRow
                ? { rating: clientReviewRow.rating, text: clientReviewRow.comment }
                : null,
            talentReview: talentReviewRow
                ? { rating: talentReviewRow.rating, text: talentReviewRow.comment }
                : null,
        };
    });
};
export const getClientFinanceManagementUrl = async (clientId) => {
    if (!env.stripeSecretKey || !env.clientDashboard) {
        throw new ApiError(503, "Finance management is not configured.");
    }
    const [account] = await db
        .select({
        stripeCustomerId: accounts.stripe_customer_id,
        email: accounts.email,
    })
        .from(accounts)
        .where(and(eq(accounts.auth_id, clientId), eq(accounts.role, "CLIENT")))
        .limit(1);
    if (!account)
        throw new ApiError(404, "Client account not found.");
    let customerId = account.stripeCustomerId;
    if (!customerId) {
        const customer = await stripe.customers.create({
            email: account.email,
            metadata: { accountId: clientId, role: "CLIENT" },
        });
        customerId = customer.id;
        await db
            .update(accounts)
            .set({ stripe_customer_id: customerId, updated_at: new Date() })
            .where(eq(accounts.auth_id, clientId));
    }
    const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${env.clientDashboard}/settings?section=finances`,
    });
    return session.url;
};
const MARKETPLACE_SEARCH_PAGE_SIZE = 20;
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
export const searchMarketplace = async (query, type, pagination = {}) => {
    const limit = pagination.limit ?? MARKETPLACE_SEARCH_PAGE_SIZE;
    const offset = pagination.offset ?? 0;
    const normalizedQuery = query.trim().toLowerCase();
    const pattern = `%${normalizedQuery.replace(/[\\%_]/g, "\\$&")}%`;
    const results = [];
    let hasMore = false;
    if (type === "all" || type === "freelancer") {
        const conditions = [];
        if (normalizedQuery) {
            const textMatch = or(ilike(accounts.first_name, pattern), ilike(accounts.last_name, pattern), ilike(freelancer_metadata.professional_title, pattern), ilike(freelancer_metadata.professional_description, pattern), ilike(freelancer_metadata.city, pattern), ilike(freelancer_metadata.country, pattern), ilike(sql `${freelancer_metadata.skills}::text`, pattern));
            if (textMatch)
                conditions.push(textMatch);
        }
        const rows = await db
            .select({
            id: freelancer_metadata.id,
            authId: freelancer_metadata.auth_id,
            firstName: accounts.first_name,
            lastName: accounts.last_name,
            avatarUrl: freelancer_metadata.avatar_url,
            professionalTitle: freelancer_metadata.professional_title,
            city: freelancer_metadata.city,
            country: freelancer_metadata.country,
            skills: freelancer_metadata.skills,
            identityVerified: accounts.identityVerified,
            rating: freelancer_earning.rating,
            jobSuccessScore: freelancer_earning.job_success_score,
        })
            .from(freelancer_metadata)
            .innerJoin(accounts, eq(accounts.auth_id, freelancer_metadata.auth_id))
            .leftJoin(freelancer_earning, eq(freelancer_earning.freelancer_id, freelancer_metadata.auth_id))
            .where(conditions.length ? and(...conditions) : undefined)
            .orderBy(desc(freelancer_earning.rating))
            .limit(limit)
            .offset(offset);
        if (rows.length === limit)
            hasMore = true;
        rows.forEach((row) => {
            const name = [row.firstName, row.lastName].filter(Boolean).join(" ").trim() ||
                "Freelancer";
            const countryName = row.country
                ? (regionNames.of(row.country) ?? row.country)
                : null;
            const location = [row.city, countryName].filter(Boolean).join(", ") ||
                "Location unavailable";
            results.push({
                id: row.id,
                accountType: "Freelancer",
                name,
                title: row.professionalTitle || "Freelancer",
                location,
                verified: row.identityVerified === true,
                skills: row.skills,
                jobSuccess: Math.round(Number(row.jobSuccessScore ?? 0)),
                rating: Number(row.rating ?? 0),
                avatarUrl: row.avatarUrl || null,
            });
        });
    }
    if (type === "all" || type === "agency") {
        const conditions = [eq(agency_metadata.is_onboarded, true)];
        if (normalizedQuery) {
            const textMatch = or(ilike(agency_metadata.name, pattern), ilike(agency_metadata.professional_title, pattern), ilike(agency_metadata.specialty, pattern), ilike(freelancer_metadata.city, pattern), ilike(freelancer_metadata.country, pattern), ilike(sql `${agency_metadata.tags}::text`, pattern));
            if (textMatch)
                conditions.push(textMatch);
        }
        const rows = await db
            .select({
            id: agency_metadata.id,
            name: agency_metadata.name,
            professionalTitle: agency_metadata.professional_title,
            specialty: agency_metadata.specialty,
            tags: agency_metadata.tags,
            avatarImage: agency_metadata.avatar_image,
            identityVerified: accounts.identityVerified,
            ownerCity: freelancer_metadata.city,
            ownerCountry: freelancer_metadata.country,
            rating: agency_earning.rating,
            jobSuccessScore: agency_earning.job_success_score,
        })
            .from(agency_metadata)
            .innerJoin(accounts, eq(accounts.auth_id, agency_metadata.owner_id))
            .leftJoin(freelancer_metadata, eq(freelancer_metadata.auth_id, agency_metadata.owner_id))
            .leftJoin(agency_earning, eq(agency_earning.agency_id, agency_metadata.id))
            .where(and(...conditions))
            .orderBy(desc(agency_earning.rating))
            .limit(limit)
            .offset(offset);
        if (rows.length === limit)
            hasMore = true;
        for (const row of rows) {
            const title = row.professionalTitle || row.specialty;
            const ownerCountryName = row.ownerCountry
                ? (regionNames.of(row.ownerCountry) ?? row.ownerCountry)
                : null;
            const location = [row.ownerCity, ownerCountryName]
                .filter(Boolean)
                .join(", ");
            results.push({
                id: row.id,
                accountType: "Agency",
                name: row.name,
                title,
                location,
                verified: row.identityVerified === true,
                skills: row.tags,
                jobSuccess: Math.round(Number(row.jobSuccessScore ?? 0)),
                rating: Number(row.rating ?? 0),
                avatarUrl: row.avatarImage?.url ?? null,
            });
        }
    }
    return { results, hasMore };
};
//# sourceMappingURL=client.service.js.map
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "../../database/clients.js";
import { accounts, client_metadata, client_spents, contracts, earning_history, freelancer_earning, freelancer_metadata, freelancer_portfolios, job_posts, payout_history, proposals } from "../../database/schema.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";
import { imageKit } from "../../config/imageKit.js";
import { randomUUID } from "crypto";
import { ACCOUNT_AUTH_CACHE_TTL_SECONDS, EARNINGS_HOLD_PERIOD_MS, getAccountAuthCacheKey, PLATFORM_FEE_RATE, STRIPE_PAYOUT_ELIGIBLE_COUNTRIES } from "../../config/constants.js";
import { redis } from "../../config/redis.js";
import { addConnects } from "../connects/connects.service.js";
import { stripe } from "../../config/stripe.js";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * Client country comes from the client profile first, then the account row.
 * Both values are selected by the job queries below, so no extra query is needed.
 */
const resolveClientCountry = (profileCountry, accountCountry) => profileCountry?.trim() || accountCountry?.trim() || null;
export const getJSSContribution = (rating) => {
    const r = Math.round(rating);
    if (r >= 5)
        return 100;
    if (r === 4)
        return 90;
    if (r === 3)
        return 75;
    if (r === 2)
        return 60;
    if (r === 1)
        return 50;
    return 0;
};
const MONTHLY_EARNINGS_SPAN = 7;
export const getFreelancerMonthlyEarnings = async (userId) => {
    const [earningsCheck] = await db
        .select({ hasEarnings: sql `count(*) > 0` })
        .from(earning_history)
        .where(eq(earning_history.freelancer_id, userId));
    const hasEarnings = earningsCheck?.hasEarnings ?? false;
    if (!hasEarnings) {
        return {
            hasEarnings: false,
            currentMonthTotal: 0,
            previousMonthTotal: 0,
            series: [],
        };
    }
    const spanStart = new Date();
    spanStart.setUTCDate(1);
    spanStart.setUTCHours(0, 0, 0, 0);
    spanStart.setUTCMonth(spanStart.getUTCMonth() - (MONTHLY_EARNINGS_SPAN - 1));
    const rows = await db
        .select({
        month: sql `to_char(date_trunc('month', ${earning_history.created_at}), 'YYYY-MM')`,
        total: sql `sum(${earning_history.amount} - ${earning_history.platform_fee_amount})`,
    })
        .from(earning_history)
        .where(and(eq(earning_history.freelancer_id, userId), gte(earning_history.created_at, spanStart)))
        .groupBy(sql `date_trunc('month', ${earning_history.created_at})`)
        .orderBy(sql `date_trunc('month', ${earning_history.created_at})`);
    const totalsByMonth = new Map(rows.map((row) => [row.month, Number(row.total)]));
    const series = Array.from({ length: MONTHLY_EARNINGS_SPAN }, (_, index) => {
        const date = new Date(spanStart);
        date.setUTCMonth(date.getUTCMonth() + index);
        const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
        return { month: key, total: totalsByMonth.get(key) ?? 0 };
    });
    return {
        hasEarnings: true,
        currentMonthTotal: series.at(-1)?.total ?? 0,
        previousMonthTotal: series.at(-2)?.total ?? 0,
        series,
    };
};
const RECENT_EARNINGS_LIMIT = 20;
export const getFreelancerEarningsOverview = async (userId) => {
    const rows = await db
        .select({
        id: earning_history.id,
        amount: earning_history.amount,
        platformFeeAmount: earning_history.platform_fee_amount,
        createdAt: earning_history.created_at,
        contractTitle: contracts.title,
        clientCompany: client_metadata.company_name,
        paidOut: sql `${payout_history.id} is not null`,
    })
        .from(earning_history)
        .innerJoin(contracts, eq(earning_history.contract_id, contracts.id))
        .leftJoin(client_metadata, eq(contracts.client_id, client_metadata.auth_id))
        .leftJoin(payout_history, eq(payout_history.earning_history_id, earning_history.id))
        .where(eq(earning_history.freelancer_id, userId))
        .orderBy(desc(earning_history.created_at));
    const now = Date.now();
    let available = 0;
    let pending = 0;
    let withdrawn = 0;
    let totalFees = 0;
    const earnings = rows.map((row) => {
        const grossAmount = Number(row.amount);
        const platformFeeAmount = Number(row.platformFeeAmount);
        const amount = Math.round((grossAmount - platformFeeAmount) * 100) / 100;
        const availableAt = new Date(row.createdAt.getTime() + EARNINGS_HOLD_PERIOD_MS);
        const isAvailable = now >= availableAt.getTime();
        totalFees += platformFeeAmount;
        // A row already transferred to Stripe (payout_history) is neither
        // available nor pending anymore — the money has already left the
        // platform, so it must not be double-counted as still withdrawable.
        let status;
        if (row.paidOut) {
            withdrawn += amount;
            status = "WITHDRAWN";
        }
        else if (isAvailable) {
            available += amount;
            status = "AVAILABLE";
        }
        else {
            pending += amount;
            status = "PENDING";
        }
        return {
            id: row.id,
            title: row.contractTitle,
            client: row.clientCompany ?? "Client",
            grossAmount,
            platformFeeAmount,
            amount,
            date: row.createdAt,
            availableAt,
            status,
        };
    });
    return {
        available,
        pending,
        withdrawn,
        lifetime: available + pending + withdrawn,
        totalFees,
        feeRatePercent: PLATFORM_FEE_RATE * 100,
        recentEarnings: earnings.slice(0, RECENT_EARNINGS_LIMIT),
    };
};
const ROLLING_WINDOW_DAYS = [30, 90, 180, 365];
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
export const getFreelancerEarningsCertificateData = async (userId) => {
    const [account] = await db
        .select({
        firstName: accounts.first_name,
        lastName: accounts.last_name,
        email: accounts.email,
        professionalTitle: freelancer_metadata.professional_title,
        country: freelancer_metadata.country,
        city: freelancer_metadata.city,
        activeSince: freelancer_metadata.created_at,
        profileId: freelancer_metadata.id,
    })
        .from(accounts)
        .innerJoin(freelancer_metadata, eq(freelancer_metadata.auth_id, accounts.auth_id))
        .where(and(eq(accounts.auth_id, userId), eq(accounts.role, "FREELANCER")))
        .limit(1);
    if (!account)
        throw new ApiError(404, "Freelancer profile not found.");
    const freelancerName = [account.firstName, account.lastName].filter(Boolean).join(" ").trim() ||
        account.email.split("@")[0] ||
        "Freelancer";
    const rows = await db
        .select({
        amount: earning_history.amount,
        platformFeeAmount: earning_history.platform_fee_amount,
        createdAt: earning_history.created_at,
    })
        .from(earning_history)
        .where(eq(earning_history.freelancer_id, userId));
    const now = new Date();
    const windows = ROLLING_WINDOW_DAYS.map((days) => {
        const sinceDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const total = rows.reduce((sum, row) => {
            if (row.createdAt < sinceDate)
                return sum;
            return sum + (Number(row.amount) - Number(row.platformFeeAmount));
        }, 0);
        return {
            label: `Last ${days} days`,
            total: Math.round(total * 100) / 100,
        };
    });
    const countryName = account.country
        ? (regionNames.of(account.country) ?? account.country)
        : null;
    return {
        freelancerName,
        professionalTitle: account.professionalTitle,
        profileUrl: `https://www.onemarketplace.io/talent/${account.profileId}`,
        location: [account.city, countryName].filter(Boolean).join(", ") || "Not specified",
        activeSince: account.activeSince ?? now,
        issuedAt: now,
        windows,
    };
};
const hasBlockingRequirements = (requirements) => (requirements?.entries ?? []).some((entry) => entry.awaiting_action_from === "user" &&
    entry.minimum_deadline.status !== "eventually_due");
export const getFreelancerPayoutManagementUrl = async (userId) => {
    if (!env.stripeSecretKey || !env.freelancerDashboard) {
        throw new ApiError(503, "Payouts are not configured.");
    }
    const [account] = await db
        .select({
        email: accounts.email,
        stripeConnectAccountId: accounts.stripe_connect_account_id,
        country: freelancer_metadata.country,
    })
        .from(accounts)
        .leftJoin(freelancer_metadata, eq(freelancer_metadata.auth_id, accounts.auth_id))
        .where(and(eq(accounts.auth_id, userId), eq(accounts.role, "FREELANCER")))
        .limit(1);
    if (!account)
        throw new ApiError(404, "Freelancer account not found.");
    let connectAccountId = account.stripeConnectAccountId;
    let hasPendingRequirements;
    if (!connectAccountId) {
        // Use the freelancer's real country when Stripe Connect's cross-border
        // transfers support it; otherwise fall back to "us" so the account can
        // still be created and paid (e.g. via a US bank account the freelancer
        // adds themselves) instead of being permanently blocked. The account's
        // country can never be changed after creation.
        const realCountry = account.country?.toUpperCase();
        const connectCountry = realCountry && STRIPE_PAYOUT_ELIGIBLE_COUNTRIES.has(realCountry)
            ? realCountry.toLowerCase()
            : "us";
        const connectAccount = await stripe.v2.core.accounts.create({
            contact_email: account.email,
            dashboard: "express",
            identity: { country: connectCountry },
            configuration: {
                // Stripe requires merchant.card_payments to be requested alongside
                // recipient.stripe_balance.stripe_transfers — even though this
                // platform never routes card payments through the freelancer's own
                // merchant capability (clients pay via the platform's own Checkout;
                // funds move to freelancers only via internal transfers).
                recipient: {
                    capabilities: {
                        stripe_balance: {
                            stripe_transfers: { requested: true },
                        },
                    },
                },
                merchant: {
                    capabilities: {
                        card_payments: { requested: true },
                    },
                },
            },
            defaults: {
                responsibilities: {
                    fees_collector: "application_express",
                    losses_collector: "application",
                },
            },
            include: ["requirements"],
        });
        connectAccountId = connectAccount.id;
        hasPendingRequirements = hasBlockingRequirements(connectAccount.requirements);
        await db
            .update(accounts)
            .set({
            stripe_connect_account_id: connectAccountId,
            updated_at: new Date(),
        })
            .where(eq(accounts.auth_id, userId));
    }
    else {
        const existingAccount = await stripe.v2.core.accounts.retrieve(connectAccountId, { include: ["requirements"] });
        hasPendingRequirements = hasBlockingRequirements(existingAccount.requirements);
    }
    const returnUrl = `${env.freelancerDashboard}/settings?section=withdrawal`;
    if (hasPendingRequirements) {
        const accountLink = await stripe.v2.core.accountLinks.create({
            account: connectAccountId,
            use_case: {
                type: "account_onboarding",
                account_onboarding: {
                    refresh_url: returnUrl,
                    return_url: returnUrl,
                },
            },
        });
        return accountLink.url;
    }
    const loginLink = await stripe.accounts.createLoginLink(connectAccountId);
    return loginLink.url;
};
// Strips spacing/punctuation so equivalent skill names entered through
// different UI conventions still match, e.g. "Next Js" (freelancer skill
// picker) vs "Next.js" (job post skill tag) — both normalize to "nextjs".
const normalizeSkill = (skill) => skill.toLowerCase().replace(/[^a-z0-9]/g, "");
export const getMatchedJobPostsBySkills = async (skillList, filters = {}) => {
    const skills = skillList.map(normalizeSkill);
    const jobs = await db
        .select({
        job: job_posts,
        companyName: client_metadata.company_name,
        profileCountry: client_metadata.country,
        accountCountry: accounts.country,
        paymentVerified: accounts.paymentMethodVerified,
        totalSpent: client_spents.total_spent,
        clientRating: client_spents.rating,
        clientReviewCount: client_spents.review_count,
    })
        .from(job_posts)
        .innerJoin(accounts, eq(job_posts.client_id, accounts.auth_id))
        .innerJoin(client_metadata, eq(job_posts.client_id, client_metadata.auth_id))
        .leftJoin(client_spents, eq(job_posts.client_id, client_spents.client_id))
        .where(eq(job_posts.status, "PUBLISHED"))
        .orderBy(desc(job_posts.published_at));
    const proposalCounts = await db
        .select({ jobId: proposals.job_id, count: count(proposals.id) })
        .from(proposals)
        .groupBy(proposals.job_id);
    const hireCounts = await db
        .select({ jobId: contracts.job_id, count: count(contracts.id) })
        .from(contracts)
        .where(inArray(contracts.status, ["ACTIVE", "COMPLETED"]))
        .groupBy(contracts.job_id);
    const counts = new Map(proposalCounts?.map((item) => [item.jobId, Number(item.count)]));
    const hires = new Map(hireCounts.map((item) => [item.jobId, Number(item.count)]));
    const filteredJobs = jobs
        .map(({ job, companyName, profileCountry, accountCountry, paymentVerified, totalSpent, clientRating, clientReviewCount, }) => ({
        ...job,
        companyName,
        clientCountry: resolveClientCountry(profileCountry, accountCountry),
        paymentVerified: paymentVerified === true,
        proposalCount: counts?.get(job.id) ?? 0,
        hireCount: hires.get(job.id) ?? 0,
        clientTotalSpent: Number(totalSpent ?? 0),
        clientRating: Number(clientRating ?? 0),
        clientReviewCount: Number(clientReviewCount ?? 0),
    }))
        .filter((job) => {
        const budget = Number(job.total_budget);
        return ((!filters.levels?.length ||
            filters.levels.includes(job.expertise_level)) &&
            (!filters.durations?.length ||
                filters.durations.includes(job.expected_duration)) &&
            (filters.minBudget === undefined || budget >= filters.minBudget) &&
            (filters.maxBudget === undefined || budget <= filters.maxBudget) &&
            (filters.minProposals === undefined ||
                job.proposalCount >= filters.minProposals) &&
            (filters.maxProposals === undefined ||
                job.proposalCount <= filters.maxProposals) &&
            (!filters.paymentVerified || job.paymentVerified));
    });
    if (filters.sort === "recent")
        return filteredJobs;
    return filteredJobs
        .map((job) => {
        const jobSkills = job.skills.map(normalizeSkill);
        const content = normalizeSkill(`${job.title} ${job.description}`);
        const skillMatches = skills.filter((skill) => jobSkills.some((jobSkill) => jobSkill === skill || jobSkill.includes(skill))).length;
        const contentMatches = skills.filter((skill) => content.includes(skill)).length;
        return { ...job, matchScore: skillMatches * 2 + contentMatches };
    })
        .filter((job) => job.matchScore > 0)
        .sort((first, second) => second.matchScore - first.matchScore ||
        new Date(second.published_at ?? second.created_at ?? 0).getTime() -
            new Date(first.published_at ?? first?.created_at ?? 0).getTime());
};
export const getFreelancerProfile = async (userId) => {
    const [result] = await db
        .select()
        .from(freelancer_metadata)
        .innerJoin(accounts, and(eq(accounts.auth_id, freelancer_metadata.auth_id), eq(accounts.role, "FREELANCER")))
        .where(eq(freelancer_metadata.auth_id, userId))
        .limit(1);
    if (!result)
        return null;
    const profile = result.freelancer_metadata;
    const portfolios = await db
        .select()
        .from(freelancer_portfolios)
        .where(eq(freelancer_portfolios.freelancer_id, profile.id));
    return {
        ...profile,
        avatarUrl: profile.avatar_url ?? "",
        identityVerified: result.accounts.identityVerified === true,
        joined_at: profile.created_at,
        portfolios,
    };
};
const isStorageConfigured = () => Boolean(env.imageKitPrivateKey && env.imageKitPublicKey && env.imageKitUrlEndpoint);
/** Deletes ImageKit assets, logging failures instead of hiding them (cleanup is best-effort). */
const deleteStorageAssets = async (fileIds) => {
    await Promise.allSettled([...new Set(fileIds.filter(Boolean))].map(async (fileId) => {
        try {
            await imageKit.files.delete(fileId);
        }
        catch (error) {
            console.error(`Failed to delete ImageKit asset ${fileId}. The asset may be orphaned in storage.`, error);
        }
    }));
};
const uploadPortfolioImages = async (userId, portfolios) => {
    if (!isStorageConfigured()) {
        throw new ApiError(503, "Portfolio image uploads are not configured.");
    }
    const uploadedFileIds = [];
    const uploadedPortfolios = [];
    try {
        for (const portfolio of portfolios) {
            /*
             * Untouched existing projects carry an already-hosted image
             * (imageId + URL). Only fresh data-URL images need uploading.
             */
            if (!portfolio.cover_image.url.startsWith("data:image/")) {
                uploadedPortfolios.push(portfolio);
                continue;
            }
            const upload = await imageKit.files.upload({
                file: portfolio.cover_image.url,
                fileName: `portfolio-${randomUUID()}`,
                folder: `/onemarketplace/freelancer-portfolios/${userId}`,
                useUniqueFileName: true,
            });
            if (!upload.fileId || !upload.url) {
                throw new ApiError(502, "Portfolio image upload failed.");
            }
            uploadedFileIds.push(upload.fileId);
            uploadedPortfolios.push({
                ...portfolio,
                cover_image: { imageId: upload.fileId, url: upload.url },
            });
        }
        return { uploadedPortfolios, uploadedFileIds };
    }
    catch (error) {
        // Roll back any images that were already uploaded in this batch.
        await deleteStorageAssets(uploadedFileIds);
        throw error;
    }
};
export const saveFreelancerProfile = async (input) => {
    const existingImages = await db
        .select({ cover_image: freelancer_portfolios.cover_image })
        .from(freelancer_portfolios)
        .innerJoin(freelancer_metadata, eq(freelancer_portfolios.freelancer_id, freelancer_metadata.id))
        .where(eq(freelancer_metadata.auth_id, input.userId));
    const { uploadedPortfolios, uploadedFileIds } = await uploadPortfolioImages(input.userId, input.portfolios);
    let profile;
    try {
        profile = await db.transaction(async (transaction) => {
            const [account] = await transaction
                .update(accounts)
                .set({ isOnboardingComplete: true })
                .where(and(eq(accounts.auth_id, input.userId), eq(accounts.role, "FREELANCER")))
                .returning();
            if (!account)
                throw new ApiError(404, "Freelancer account not found.");
            const metadataValues = {
                professional_title: input.professional_title,
                professional_description: input.professional_description,
                hourly_rate: input.hourly_rate,
                country: input.country,
                city: input.city,
                availability_status: input.availability_status,
                weekly_availability: input.weekly_availability,
                experience_level: input.experience_level,
                skills: input.skills,
                languages: input.languages,
                avatar_url: input.avatarUrl || null,
            };
            // Upsert: one metadata row per auth_id, no duplicates.
            const [metadata] = await transaction
                .insert(freelancer_metadata)
                .values({
                auth_id: input.userId,
                ...metadataValues,
            })
                .onConflictDoUpdate({
                target: freelancer_metadata.auth_id,
                set: metadataValues,
            })
                .returning();
            if (!metadata) {
                throw new ApiError(500, "Freelancer profile could not be saved.");
            }
            /*
             * Portfolio is saved as full replacement: delete then re-insert the
             * submitted set. The image lifecycle is handled by comparing the
             * retained imageIds against the pre-save snapshot below.
             */
            await transaction
                .delete(freelancer_portfolios)
                .where(eq(freelancer_portfolios.freelancer_id, metadata.id));
            const portfolios = uploadedPortfolios.length
                ? await transaction
                    .insert(freelancer_portfolios)
                    .values(uploadedPortfolios.map((portfolio) => ({ freelancer_id: metadata.id, ...portfolio })))
                    .returning()
                : [];
            return {
                professional_title: metadata.professional_title,
                professional_description: metadata.professional_description,
                hourly_rate: metadata.hourly_rate,
                country: metadata.country,
                city: metadata.city,
                availability_status: metadata.availability_status,
                weekly_availability: metadata.weekly_availability,
                experience_level: metadata.experience_level,
                skills: metadata.skills,
                languages: metadata.languages,
                avatarUrl: metadata.avatar_url ?? "",
                portfolios,
                identityVerified: account.identityVerified === true,
                joined_at: metadata.created_at,
            };
        });
    }
    catch (error) {
        // The DB write failed: roll back every image uploaded for this save.
        await deleteStorageAssets(uploadedFileIds);
        throw error;
    }
    /*
     * The transaction committed. DB now points only to `retainedImageIds`.
     * Delete storage assets that are no longer referenced: replaced images
     * and images of removed projects. The new uploads are never in this set.
     */
    const retainedImageIds = new Set(uploadedPortfolios.map(({ cover_image }) => cover_image.imageId));
    const staleImageIds = existingImages
        .map(({ cover_image }) => cover_image.imageId)
        .filter((fileId) => fileId && !retainedImageIds.has(fileId));
    await deleteStorageAssets(staleImageIds);
    await addConnects(input.userId);
    // Best-effort cache refresh: a Redis failure must not fail a committed save.
    try {
        await redis.setEx(getAccountAuthCacheKey(input.userId, "freelancer"), ACCOUNT_AUTH_CACHE_TTL_SECONDS, JSON.stringify({
            userId: input.userId,
            role: "freelancer",
            accountExists: true,
            isOnboarded: true,
            emailVerified: true,
        }));
    }
    catch (error) {
        console.warn("Freelancer auth cache could not be refreshed after profile save.", error);
    }
    return profile;
};
/** Job feed for the freelancer dashboard. */
export const getMatchedJobPosts = async (userId, filters = {}) => {
    const [profile] = await db
        .select({ skills: freelancer_metadata.skills })
        .from(freelancer_metadata)
        .where(eq(freelancer_metadata.auth_id, userId));
    if (!profile)
        throw new ApiError(404, "Freelancer profile not found.");
    const skills = profile.skills.map((skill) => skill.toLowerCase());
    const jobs = await db
        .select({
        job: job_posts,
        companyName: client_metadata.company_name,
        profileCountry: client_metadata.country,
        accountCountry: accounts.country,
        paymentVerified: accounts.paymentMethodVerified,
    })
        .from(job_posts)
        .innerJoin(accounts, eq(job_posts.client_id, accounts.auth_id))
        .innerJoin(client_metadata, eq(job_posts.client_id, client_metadata.auth_id))
        .where(eq(job_posts.status, "PUBLISHED"))
        .orderBy(desc(job_posts.published_at));
    const proposalCounts = await db
        .select({ jobId: proposals.job_id, count: count(proposals.id) })
        .from(proposals)
        .groupBy(proposals.job_id);
    const counts = new Map(proposalCounts.map((item) => [item.jobId, Number(item.count)]));
    const filteredJobs = jobs
        .map(({ job, companyName, profileCountry, accountCountry, paymentVerified }) => ({
        ...job,
        companyName,
        clientCountry: resolveClientCountry(profileCountry, accountCountry),
        paymentVerified: paymentVerified === true,
        proposalCounts: counts.get(job.id) ?? 0,
    }))
        .filter((job) => {
        const budget = Number(job.total_budget);
        return ((!filters.levels?.length || filters.levels.includes(job.expertise_level)) &&
            (!filters.durations?.length || filters.durations.includes(job.expected_duration)) &&
            (filters.minBudget === undefined || budget >= filters.minBudget) &&
            (filters.maxBudget === undefined || budget <= filters.maxBudget) &&
            (filters.minProposals === undefined || job.proposalCounts >= filters.minProposals) &&
            (filters.maxProposals === undefined || job.proposalCounts <= filters.maxProposals) &&
            (!filters.paymentVerified || job.paymentVerified));
    });
    // "recent": already ordered by published_at desc from the query.
    if (filters.sort === "recent")
        return filteredJobs;
    const postedAt = (job) => new Date(job.published_at ?? job.created_at ?? 0).getTime();
    return filteredJobs
        .map((job) => {
        const jobSkills = job.skills.map((skill) => skill.toLowerCase());
        const content = `${job.title} ${job.description}`.toLowerCase();
        const skillMatches = skills.filter((skill) => jobSkills.some((jobSkill) => jobSkill === skill || jobSkill.includes(skill))).length;
        const contentMatches = skills.filter((skill) => content.includes(skill)).length;
        return { ...job, matchScore: skillMatches * 2 + contentMatches };
    })
        // Hides jobs that share nothing with the freelancer's skills.
        .filter((job) => job.matchScore > 0)
        .sort((first, second) => second.matchScore - first.matchScore ||
        postedAt(second) - postedAt(first));
};
/** Single job post for the freelancer job details page. */
export const getFreelancerJobPost = async (jobId) => {
    if (!UUID_PATTERN.test(jobId)) {
        throw new ApiError(400, "Invalid job id.");
    }
    const [result] = await db
        .select({
        job: job_posts,
        companyName: client_metadata.company_name,
        companyDescription: client_metadata.company_description,
        profileCountry: client_metadata.country,
        accountCountry: accounts.country,
        paymentVerified: accounts.paymentMethodVerified,
        clientJoinedAt: accounts.created_at,
    })
        .from(job_posts)
        .innerJoin(accounts, eq(job_posts.client_id, accounts.auth_id))
        .innerJoin(client_metadata, eq(job_posts.client_id, client_metadata.auth_id))
        .where(and(eq(job_posts.id, jobId), eq(job_posts.status, "PUBLISHED")))
        .limit(1);
    if (!result)
        throw new ApiError(404, "Job post not found.");
    const [proposalTotal] = await db
        .select({ count: count(proposals.id) })
        .from(proposals)
        .where(eq(proposals.job_id, jobId));
    return {
        ...result.job,
        companyName: result.companyName,
        companyDescription: result.companyDescription,
        clientCountry: resolveClientCountry(result.profileCountry, result.accountCountry),
        paymentVerified: result.paymentVerified === true,
        clientJoinedAt: result.clientJoinedAt,
        proposalCounts: Number(proposalTotal?.count ?? 0),
    };
};
export const getPublicFreelancerProfile = async (profileId) => {
    // freelancer_metadata.id is a uuid column; anything else would throw a 500.
    if (!UUID_PATTERN.test(profileId))
        return null;
    const [row] = await db
        .select({
        profile: freelancer_metadata,
        firstName: accounts.first_name,
        lastName: accounts.last_name,
        identityVerified: accounts.identityVerified,
    })
        .from(freelancer_metadata)
        .innerJoin(accounts, and(eq(accounts.auth_id, freelancer_metadata.auth_id), eq(accounts.role, "FREELANCER")))
        .where(eq(freelancer_metadata.id, profileId))
        .limit(1);
    if (!row)
        return null;
    const { profile } = row;
    const portfolios = await db
        .select({
        id: freelancer_portfolios.id,
        title: freelancer_portfolios.title,
        category: freelancer_portfolios.category,
        description: freelancer_portfolios.description,
        live_url: freelancer_portfolios.live_url,
        cover_image: freelancer_portfolios.cover_image,
    })
        .from(freelancer_portfolios)
        .where(eq(freelancer_portfolios.freelancer_id, profile.id))
        .orderBy(desc(freelancer_portfolios.created_at));
    const name = [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
    return {
        id: profile.id,
        name: name || "Freelancer",
        avatarUrl: profile.avatar_url ?? null,
        identityVerified: row.identityVerified === true,
        professional_title: profile.professional_title,
        professional_description: profile.professional_description,
        hourly_rate: profile.hourly_rate,
        country: profile.country,
        city: profile.city,
        availability_status: profile.availability_status,
        weekly_availability: profile.weekly_availability,
        experience_level: profile.experience_level,
        skills: profile.skills,
        languages: profile.languages,
        portfolios,
        joined_at: profile.created_at,
    };
};
const PUBLIC_TALENT_PAGE_SIZE = 20;
const publicTalentRegionNames = new Intl.DisplayNames(["en"], {
    type: "region",
});
export const searchPublicFreelancers = async (filters, pagination = {}) => {
    const limit = pagination.limit ?? PUBLIC_TALENT_PAGE_SIZE;
    const offset = pagination.offset ?? 0;
    const normalizedQuery = (filters.query ?? "").trim().toLowerCase();
    const conditions = [];
    if (filters.verifiedOnly)
        conditions.push(eq(accounts.identityVerified, true));
    if (filters.availableOnly) {
        conditions.push(eq(freelancer_metadata.availability_status, "AVAILABLE"));
    }
    if (filters.minRating) {
        conditions.push(gte(freelancer_earning.rating, String(filters.minRating)));
    }
    if (filters.minSuccess) {
        conditions.push(gte(freelancer_earning.job_success_score, String(filters.minSuccess)));
    }
    if (filters.minRate) {
        conditions.push(gte(freelancer_metadata.hourly_rate, String(filters.minRate)));
    }
    if (filters.maxRate) {
        conditions.push(lte(freelancer_metadata.hourly_rate, String(filters.maxRate)));
    }
    if (normalizedQuery) {
        // Search runs in SQL, before limit/offset, so pagination and `hasMore`
        // describe the filtered result set instead of the unfiltered page.
        const pattern = `%${normalizedQuery.replace(/[\\%_]/g, "\\$&")}%`;
        const textMatch = or(ilike(accounts.first_name, pattern), ilike(accounts.last_name, pattern), ilike(freelancer_metadata.professional_title, pattern), ilike(freelancer_metadata.professional_description, pattern), ilike(freelancer_metadata.city, pattern), ilike(freelancer_metadata.country, pattern), ilike(sql `${freelancer_metadata.skills}::text`, pattern));
        if (textMatch)
            conditions.push(textMatch);
    }
    const orderBy = (() => {
        switch (filters.sort) {
            case "rating":
                return desc(freelancer_earning.rating);
            case "success":
                return desc(freelancer_earning.job_success_score);
            case "projects":
                return desc(freelancer_earning.completed_jobs);
            case "rate-low":
                return asc(freelancer_metadata.hourly_rate);
            default:
                return desc(sql `${freelancer_earning.rating} * ${freelancer_earning.job_success_score}`);
        }
    })();
    const rows = await db
        .select({
        id: freelancer_metadata.id,
        authId: freelancer_metadata.auth_id,
        firstName: accounts.first_name,
        lastName: accounts.last_name,
        avatarUrl: freelancer_metadata.avatar_url,
        professionalTitle: freelancer_metadata.professional_title,
        professionalDescription: freelancer_metadata.professional_description,
        hourlyRate: freelancer_metadata.hourly_rate,
        city: freelancer_metadata.city,
        country: freelancer_metadata.country,
        skills: freelancer_metadata.skills,
        availabilityStatus: freelancer_metadata.availability_status,
        identityVerified: accounts.identityVerified,
        rating: freelancer_earning.rating,
        jobSuccessScore: freelancer_earning.job_success_score,
        completedJobs: freelancer_earning.completed_jobs,
        reviewCount: freelancer_earning.review_count,
    })
        .from(freelancer_metadata)
        .innerJoin(accounts, eq(accounts.auth_id, freelancer_metadata.auth_id))
        .leftJoin(freelancer_earning, eq(freelancer_earning.freelancer_id, freelancer_metadata.auth_id))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset);
    const hasMore = rows.length === limit;
    if (!rows.length)
        return { results: [], hasMore: false };
    const results = [];
    rows.forEach((row) => {
        const name = [row.firstName, row.lastName].filter(Boolean).join(" ").trim() ||
            "Freelancer";
        const countryName = row.country
            ? (publicTalentRegionNames.of(row.country) ?? row.country)
            : null;
        const location = [row.city, countryName].filter(Boolean).join(", ") ||
            "Location unavailable";
        results.push({
            id: row.id,
            name,
            avatarUrl: row.avatarUrl || null,
            title: row.professionalTitle || "Freelancer",
            location,
            verified: row.identityVerified === true,
            active: row.availabilityStatus === "AVAILABLE",
            jobSuccess: Math.round(Number(row.jobSuccessScore ?? 0)),
            completedProjects: Number(row.completedJobs ?? 0),
            rating: Number(row.rating ?? 0),
            reviews: Number(row.reviewCount ?? 0),
            hourlyRate: Number(row.hourlyRate),
            skills: row.skills,
            summary: row.professionalDescription,
        });
    });
    return { results, hasMore };
};
//# sourceMappingURL=freelancer.service.js.map
import { and, desc, eq, gte, sql, inArray, ne } from "drizzle-orm";
import { db } from "../../database/clients.js";
import { accounts, agency_earning, agency_metadata, client_metadata, client_spents, connects, connects_history, contracts, conversation_participants, conversations, freelancer_earning, freelancer_metadata, freelancer_portfolios, job_posts, messages, proposals, } from "../../database/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { CONNECTS_CACHE_TTL_SECONDS, getAgencyConnectsCacheKey, getConnectsCacheKey, PROPOSAL_CONNECTS, PROPOSAL_STATUSES } from "../../config/constants.js";
import { redis } from "../../config/redis.js";
import { sendNotification } from "../../events/publisher.js";
const ACTIVE_PROPOSAL_STATUSES = new Set([
    "SUBMITTED",
    "VIEWED",
    "INTERVIEWED",
    "HIRED"
]);
// Once a proposal reaches one of these, a client can't move it again.
const CLOSED_STATUSES = new Set(["REJECTED", "HIRED"]);
export const submitProposal = async (freelancerId, input) => {
    const result = await db.transaction(async (transaction) => {
        const [job] = await transaction
            .select({
            id: job_posts.id,
            title: job_posts.title,
            clientId: job_posts.client_id,
            screeningQuestions: job_posts.screening_questions,
        })
            .from(job_posts)
            .where(and(eq(job_posts.id, input.jobId), eq(job_posts.status, "PUBLISHED")))
            .limit(1);
        if (!job)
            throw new ApiError(404, "Job post not found.");
        const questions = job.screeningQuestions ?? [];
        if (input.screeningAnswers.length !== questions.length ||
            input.screeningAnswers.some((answer) => !answer)) {
            throw new ApiError(400, "Answer every screening question.");
        }
        const [balance] = await transaction
            .update(connects)
            .set({
            connects: sql `${connects.connects} - ${PROPOSAL_CONNECTS}`,
            updated_at: new Date(),
        })
            .where(and(eq(connects.freelancer_id, freelancerId), gte(connects.connects, PROPOSAL_CONNECTS)))
            .returning();
        if (!balance)
            throw new ApiError(400, "Not enough Connects.");
        const [proposal] = await transaction
            .insert(proposals)
            .values({
            job_id: input.jobId,
            sender_id: freelancerId,
            sender_type: "FREELANCER",
            cover_letter: input.coverLetter,
            bid_amount: input.bidAmount.toString(),
            duration: input.duration,
            screening_answers: questions.map((question, index) => ({
                question,
                answer: input.screeningAnswers[index],
            })),
        })
            .onConflictDoNothing()
            .returning();
        if (!proposal)
            throw new ApiError(409, "You already submitted a proposal for this job.");
        await transaction.insert(connects_history).values({
            connects_id: balance.id,
            type: "Proposal submitted",
            description: job.title,
            amount: -PROPOSAL_CONNECTS,
        });
        return {
            proposal,
            connects: balance.connects,
            clientId: job.clientId,
            jobTitle: job.title,
        };
    });
    // The database is the source of truth, so a cache failure must not fail the request.
    try {
        await redis.setEx(getConnectsCacheKey(freelancerId), CONNECTS_CACHE_TTL_SECONDS, String(result.connects));
    }
    catch (error) {
        console.error("Failed to update connects cache:", error);
    }
    // The proposal is already committed; a messaging outage must not fail it.
    try {
        await sendNotification({
            recipientId: result.clientId,
            type: "PROPOSAL_RECEIVED",
            title: "New proposal received",
            message: `A freelancer applied to “${result.jobTitle}”.`,
            link: `/proposals/${input.jobId}`,
            metadata: { proposalId: result.proposal.id, jobId: input.jobId },
        });
    }
    catch (error) {
        console.error("Failed to send proposal notification:", error);
    }
    return result;
};
export const getFreelancerProposalMetadata = async (freelancerId) => {
    const freelancerProposals = await db.select({
        jobId: proposals.job_id,
        status: proposals.status,
        submittedAt: proposals.created_at,
    }).from(proposals).where(and(eq(proposals.sender_id, freelancerId), eq(proposals.sender_type, "FREELANCER"))).orderBy(desc(proposals.created_at));
    const normalizedProposals = freelancerProposals.map((proposal) => ({
        ...proposal,
        status: proposal.status.toUpperCase(),
    }));
    return {
        proposals: normalizedProposals,
        counts: {
            total: normalizedProposals.length,
            active: normalizedProposals.filter((proposal) => ACTIVE_PROPOSAL_STATUSES.has(proposal.status)).length,
            viewed: normalizedProposals.filter((proposal) => proposal.status === "VIEWED").length,
            interviewed: normalizedProposals.filter((proposal) => proposal.status === "INTERVIEWED").length,
        },
    };
};
export const getFreelancerProposals = async (freelancerId) => db
    .select({
    id: proposals.id,
    jobId: proposals.job_id,
    title: job_posts.title,
    company: client_metadata.company_name,
    status: proposals.status,
    submittedAt: proposals.created_at,
    budget: job_posts.total_budget,
    bidAmount: proposals.bid_amount,
    duration: proposals.duration,
    coverLetter: proposals.cover_letter,
    skills: job_posts.skills,
})
    .from(proposals)
    .innerJoin(job_posts, eq(proposals.job_id, job_posts.id))
    .leftJoin(client_metadata, eq(job_posts.client_id, client_metadata.auth_id))
    .where(and(eq(proposals.sender_id, freelancerId), eq(proposals.sender_type, "FREELANCER")))
    .orderBy(desc(proposals.created_at));
export const submitAgencyProposal = async (agencyId, input) => {
    const result = await db.transaction(async (transaction) => {
        const [job] = await transaction
            .select({
            id: job_posts.id,
            title: job_posts.title,
            clientId: job_posts.client_id,
            screeningQuestions: job_posts.screening_questions,
        })
            .from(job_posts)
            .where(and(eq(job_posts.id, input.jobId), eq(job_posts.status, "PUBLISHED")))
            .limit(1);
        if (!job)
            throw new ApiError(404, "Job post not found.");
        const questions = job.screeningQuestions ?? [];
        if (input.screeningAnswers.length !== questions.length ||
            input.screeningAnswers.some((answer) => !answer)) {
            throw new ApiError(400, "Answer every screening question.");
        }
        const [agency] = await transaction
            .select({ name: agency_metadata.name })
            .from(agency_metadata)
            .where(eq(agency_metadata.id, agencyId))
            .limit(1);
        if (!agency)
            throw new ApiError(404, "Agency workspace not found.");
        const [balance] = await transaction
            .update(connects)
            .set({
            connects: sql `${connects.connects} - ${PROPOSAL_CONNECTS}`,
            updated_at: new Date(),
        })
            .where(and(eq(connects.agency_id, agencyId), gte(connects.connects, PROPOSAL_CONNECTS)))
            .returning();
        if (!balance)
            throw new ApiError(400, "Not enough Connects.");
        const [proposal] = await transaction
            .insert(proposals)
            .values({
            job_id: input.jobId,
            sender_id: agencyId,
            sender_type: "AGENCY",
            cover_letter: input.coverLetter,
            bid_amount: input.bidAmount.toString(),
            duration: input.duration,
            screening_answers: questions.map((question, index) => ({
                question,
                answer: input.screeningAnswers[index],
            })),
        })
            .onConflictDoNothing()
            .returning();
        if (!proposal) {
            throw new ApiError(409, "Your agency already submitted a proposal for this job.");
        }
        await transaction.insert(connects_history).values({
            connects_id: balance.id,
            type: "Proposal submitted",
            description: job.title,
            amount: -PROPOSAL_CONNECTS,
        });
        return {
            proposal,
            connects: balance.connects,
            clientId: job.clientId,
            jobTitle: job.title,
            agencyName: agency.name,
        };
    });
    // Both of these run after the transaction committed; neither may turn a
    // successful proposal into an error response.
    try {
        await redis.setEx(getAgencyConnectsCacheKey(agencyId), CONNECTS_CACHE_TTL_SECONDS, String(result.connects));
    }
    catch (error) {
        console.error("Failed to update agency connects cache:", error);
    }
    try {
        await sendNotification({
            recipientId: result.clientId,
            type: "PROPOSAL_RECEIVED",
            title: "New proposal received",
            message: `${result.agencyName} applied to “${result.jobTitle}”.`,
            link: `/proposals/${input.jobId}`,
            metadata: { proposalId: result.proposal.id, jobId: input.jobId },
        });
    }
    catch (error) {
        console.error("Failed to send agency proposal notification:", error);
    }
    return result;
};
export const getAgencyProposalMetadata = async (agencyId) => {
    const agencyProposals = await db
        .select({
        jobId: proposals.job_id,
        status: proposals.status,
        submittedAt: proposals.created_at,
    })
        .from(proposals)
        .where(and(eq(proposals.sender_id, agencyId), eq(proposals.sender_type, "AGENCY")))
        .orderBy(desc(proposals.created_at));
    const normalizedProposals = agencyProposals.map((proposal) => ({
        ...proposal,
        status: proposal.status.toUpperCase(),
    }));
    return {
        proposals: normalizedProposals,
        counts: {
            total: normalizedProposals.length,
            active: normalizedProposals.filter((proposal) => ACTIVE_PROPOSAL_STATUSES.has(proposal.status)).length,
            viewed: normalizedProposals.filter((proposal) => proposal.status === "VIEWED").length,
            interviewed: normalizedProposals.filter((proposal) => proposal.status === "INTERVIEWED").length,
        },
    };
};
export const getAgencyProposals = async (agencyId) => db
    .select({
    id: proposals.id,
    jobId: proposals.job_id,
    title: job_posts.title,
    company: client_metadata.company_name,
    status: proposals.status,
    submittedAt: proposals.created_at,
    budget: job_posts.total_budget,
    bidAmount: proposals.bid_amount,
    duration: proposals.duration,
    coverLetter: proposals.cover_letter,
    skills: job_posts.skills,
    clientRating: client_spents.rating,
    clientReviewCount: client_spents.review_count,
    clientTotalSpent: client_spents.total_spent,
    conversationId: conversations.id,
})
    .from(proposals)
    .innerJoin(job_posts, eq(proposals.job_id, job_posts.id))
    .leftJoin(client_metadata, eq(job_posts.client_id, client_metadata.auth_id))
    .leftJoin(client_spents, eq(job_posts.client_id, client_spents.client_id))
    .leftJoin(conversations, eq(conversations.proposal_id, proposals.id))
    .where(and(eq(proposals.sender_id, agencyId), eq(proposals.sender_type, "AGENCY")))
    .orderBy(desc(proposals.created_at));
export const getClientJobProposals = async (clientId, jobId) => {
    const rows = await db
        .select({
        id: proposals.id,
        conversationId: conversations.id,
        contractId: contracts.id,
        contractStatus: contracts.status,
        senderId: proposals.sender_id,
        senderType: proposals.sender_type,
        freelancerId: freelancer_metadata.id,
        email: accounts.email,
        firstName: accounts.first_name,
        lastName: accounts.last_name,
        verified: accounts.identityVerified,
        title: freelancer_metadata.professional_title,
        country: freelancer_metadata.country,
        city: freelancer_metadata.city,
        skills: freelancer_metadata.skills,
        languages: freelancer_metadata.languages,
        avatarUrl: freelancer_metadata.avatar_url,
        coverLetter: proposals.cover_letter,
        bidAmount: proposals.bid_amount,
        duration: proposals.duration,
        screeningAnswers: proposals.screening_answers,
        status: proposals.status,
        isShortlisted: proposals.is_shortlisted,
        submittedAt: proposals.created_at,
        jobSuccessScore: freelancer_earning.job_success_score,
        rating: freelancer_earning.rating,
        completedJobs: freelancer_earning.completed_jobs,
        agencyJobSuccessScore: agency_earning.job_success_score,
        agencyRating: agency_earning.rating,
        agencyCompletedJobs: agency_earning.completed_jobs,
        agencyName: agency_metadata.name,
        agencyAvatar: agency_metadata.avatar_image,
        agencyTags: agency_metadata.tags,
    })
        .from(proposals)
        .innerJoin(job_posts, eq(proposals.job_id, job_posts.id))
        .leftJoin(freelancer_metadata, eq(proposals.sender_id, freelancer_metadata.auth_id))
        .leftJoin(accounts, eq(proposals.sender_id, accounts.auth_id))
        .leftJoin(conversations, eq(conversations.proposal_id, proposals.id))
        .leftJoin(contracts, eq(contracts.proposal_id, proposals.id))
        .leftJoin(freelancer_earning, eq(proposals.sender_id, freelancer_earning.freelancer_id))
        .leftJoin(agency_metadata, sql `${proposals.sender_id} = ${agency_metadata.id}::text`)
        .leftJoin(agency_earning, sql `${proposals.sender_id} = ${agency_earning.agency_id}::text`)
        .where(and(eq(proposals.job_id, jobId), eq(job_posts.client_id, clientId)))
        .orderBy(desc(proposals.created_at));
    // One batched query for every bidder's portfolio (no N+1).
    const profileIds = [
        ...new Set(rows
            .map((row) => row.freelancerId)
            .filter((id) => Boolean(id))),
    ];
    const portfolioRows = profileIds.length
        ? await db
            .select({
            freelancerId: freelancer_portfolios.freelancer_id,
            title: freelancer_portfolios.title,
            category: freelancer_portfolios.category,
            description: freelancer_portfolios.description,
            live_url: freelancer_portfolios.live_url,
            cover_image: freelancer_portfolios.cover_image,
        })
            .from(freelancer_portfolios)
            .where(inArray(freelancer_portfolios.freelancer_id, profileIds))
            .orderBy(desc(freelancer_portfolios.created_at))
        : [];
    const portfoliosByProfile = new Map();
    for (const { freelancerId, ...portfolio } of portfolioRows) {
        const list = portfoliosByProfile.get(freelancerId) ?? [];
        list.push(portfolio);
        portfoliosByProfile.set(freelancerId, list);
    }
    return rows.map(({ firstName, lastName, email, jobSuccessScore, rating, completedJobs, agencyJobSuccessScore, agencyRating, agencyCompletedJobs, agencyName, agencyAvatar, agencyTags, ...proposal }) => {
        const isAgency = proposal.senderType === "AGENCY";
        // Pick the stats that belong to whoever actually sent the proposal.
        const stats = isAgency
            ? {
                jobSuccessScore: Number(agencyJobSuccessScore ?? 0),
                rating: Number(agencyRating ?? 0),
                completedJobs: Number(agencyCompletedJobs ?? 0),
            }
            : {
                jobSuccessScore: Number(jobSuccessScore ?? 0),
                rating: Number(rating ?? 0),
                completedJobs: Number(completedJobs ?? 0),
            };
        const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
        const senderName = isAgency
            ? (agencyName ?? "Agency")
            : fullName || email?.split("@")[0] || null;
        return {
            ...proposal,
            ...stats,
            senderName,
            // Agencies use their own avatar; freelancers keep avatarUrl from the select.
            ...(isAgency && {
                avatarUrl: agencyAvatar?.url ?? null,
                agencyTags: agencyTags ?? [],
            }),
            portfolios: proposal.freelancerId
                ? (portfoliosByProfile.get(proposal.freelancerId) ?? [])
                : [],
            // `is_shortlisted` is the durable flag; older rows may have been
            // shortlisted before the status was updated alongside it.
            isShortlisted: proposal.isShortlisted || proposal.status === "SHORTLISTED",
        };
    });
};
export const updateProposal = async (proposalId, clientId, target) => {
    const [existing] = await db
        .select({
        id: proposals.id,
        senderId: proposals.sender_id,
        senderType: proposals.sender_type,
        status: proposals.status,
        isShortlisted: proposals.is_shortlisted,
        jobTitle: job_posts.title,
    })
        .from(proposals)
        // proves the proposal belongs to a job owned by this client
        .innerJoin(job_posts, eq(proposals.job_id, job_posts.id))
        .where(and(eq(proposals.id, proposalId), eq(job_posts.client_id, clientId)))
        .limit(1);
    if (!existing)
        throw new ApiError(404, "Proposal not found.");
    const current = existing.status.toUpperCase();
    const isShortlisted = target === "SHORTLISTED";
    // Already there: keep the shortlist flag in sync for rows written before
    // the status and flag were updated together.
    if (current === target) {
        if (isShortlisted && !existing.isShortlisted) {
            await db
                .update(proposals)
                .set({ is_shortlisted: true, updated_at: new Date() })
                .where(eq(proposals.id, proposalId));
        }
        return { ...existing, isShortlisted, changed: false };
    }
    // "Viewed" is only a first-open marker (or an un-shortlist). It must never
    // pull an interviewed/offered proposal back to Viewed, which also covers the
    // race where the drawer's fire-and-forget "viewed" call lands after another
    // status change.
    if (target === "VIEWED" && current !== "SUBMITTED" && current !== "SHORTLISTED") {
        return { ...existing, changed: false };
    }
    if (CLOSED_STATUSES.has(current)) {
        throw new ApiError(409, `This proposal is already ${current.toLowerCase()}.`);
    }
    // Compare-and-set on the old status so two clicks can't overwrite each other.
    const [updated] = await db
        .update(proposals)
        .set({
        status: target,
        // Keep the job's shortlist count aligned with the pipeline status.
        is_shortlisted: isShortlisted,
        updated_at: new Date(),
    })
        .where(and(eq(proposals.id, proposalId), eq(proposals.status, existing.status)))
        .returning();
    return {
        ...existing,
        status: updated?.status ?? existing.status,
        isShortlisted: updated ? isShortlisted : existing.isShortlisted,
        changed: Boolean(updated),
    };
};
export const shortlistProposal = async (proposalId, clientId) => {
    const [proposal] = await db
        .update(proposals)
        .set({ is_shortlisted: true, updated_at: new Date() })
        .from(job_posts)
        .where(and(eq(proposals.id, proposalId), eq(proposals.job_id, job_posts.id), eq(job_posts.client_id, clientId)))
        .returning({ id: proposals.id, isShortlisted: proposals.is_shortlisted });
    if (!proposal)
        throw new ApiError(404, "Proposal not found.");
    return proposal;
};
export const startProposalInterview = async (proposalId, clientId, openingMessage) => {
    const result = await db.transaction(async (transaction) => {
        const [proposal] = await transaction
            .select({
            id: proposals.id,
            freelancerId: proposals.sender_id,
            senderType: proposals.sender_type,
            coverLetter: proposals.cover_letter,
            jobId: proposals.job_id,
            jobTitle: job_posts.title,
        })
            .from(proposals)
            .innerJoin(job_posts, eq(proposals.job_id, job_posts.id))
            .where(and(eq(proposals.id, proposalId), eq(job_posts.client_id, clientId)))
            .limit(1);
        if (!proposal)
            throw new ApiError(404, "Proposal not found.");
        const [interviewed] = await transaction
            .update(proposals)
            .set({
            status: "INTERVIEWED",
            // The proposal has moved past the shortlist stage.
            is_shortlisted: false,
            updated_at: new Date(),
        })
            .where(and(eq(proposals.id, proposal.id), inArray(proposals.status, ["SUBMITTED", "VIEWED", "SHORTLISTED"])))
            .returning({ id: proposals.id });
        if (!interviewed) {
            throw new ApiError(409, "Interview has already been started.");
        }
        // Must match the key `createConversation` builds for the same job, or the
        // interview would create a second thread for an existing conversation.
        const contextKey = proposal.senderType === "AGENCY"
            ? `job:${proposal.jobId}:client:${clientId}:agency:${proposal.freelancerId}`
            : `job:${proposal.jobId}:client:${clientId}:talent:${proposal.freelancerId}`;
        const [createdConversation] = await transaction
            .insert(conversations)
            .values({
            job_id: proposal.jobId,
            proposal_id: proposal.id,
            context_key: contextKey,
        })
            .onConflictDoNothing({ target: conversations.context_key })
            .returning({ id: conversations.id });
        const conversation = createdConversation ??
            (await transaction
                .select({ id: conversations.id })
                .from(conversations)
                .where(eq(conversations.context_key, contextKey))
                .limit(1))[0];
        if (!conversation) {
            throw new ApiError(500, "Conversation could not be created.");
        }
        const isAgencyProposal = proposal.senderType === "AGENCY";
        // An agency proposal is addressed by agency id; only a personal proposal
        // has an account id to store as the participant.
        await transaction
            .insert(conversation_participants)
            .values([
            {
                conversation_id: conversation.id,
                account_id: clientId,
                participant_type: "CLIENT",
            },
            isAgencyProposal
                ? {
                    conversation_id: conversation.id,
                    agency_id: proposal.freelancerId,
                    participant_type: "AGENCY",
                }
                : {
                    conversation_id: conversation.id,
                    account_id: proposal.freelancerId,
                    participant_type: "FREELANCER",
                },
        ])
            .onConflictDoNothing();
        const now = new Date();
        const [proposalMessage] = await transaction
            .insert(messages)
            .values({
            conversation_id: conversation.id,
            // messages.sender_id references accounts; an agency-proposed
            // interview still shows the cover letter, without an account sender.
            sender_id: isAgencyProposal ? null : proposal.freelancerId,
            body: proposal.coverLetter,
            created_at: now,
        })
            .returning({ id: messages.id, createdAt: messages.created_at });
        if (!proposalMessage) {
            throw new ApiError(500, "Interview messages could not be created.");
        }
        const [clientMessage] = await transaction
            .insert(messages)
            .values({
            conversation_id: conversation.id,
            sender_id: clientId,
            body: openingMessage,
            reply_to_message_id: proposalMessage.id,
            created_at: new Date(now.getTime() + 1),
        })
            .returning({ id: messages.id, createdAt: messages.created_at });
        if (!clientMessage) {
            throw new ApiError(500, "Interview messages could not be created.");
        }
        await transaction
            .update(conversations)
            .set({
            proposal_id: proposal.id,
            last_message_id: clientMessage.id,
            last_message_at: clientMessage.createdAt,
            updated_at: new Date(),
        })
            .where(eq(conversations.id, conversation.id));
        await transaction
            .update(conversation_participants)
            .set({
            last_read_message_id: clientMessage.id,
            last_read_at: new Date(),
            unread_count: 0,
        })
            .where(and(eq(conversation_participants.conversation_id, conversation.id), eq(conversation_participants.account_id, clientId)));
        await transaction
            .update(conversation_participants)
            .set({
            unread_count: sql `${conversation_participants.unread_count} + 1`,
        })
            .where(and(eq(conversation_participants.conversation_id, conversation.id), ne(conversation_participants.participant_type, "CLIENT")));
        const [balance] = await transaction
            .update(connects)
            .set({
            connects: sql `${connects.connects} + ${PROPOSAL_CONNECTS}`,
            updated_at: new Date(),
        })
            .where(isAgencyProposal
            ? eq(connects.agency_id, proposal.freelancerId)
            : eq(connects.freelancer_id, proposal.freelancerId))
            .returning();
        if (!balance)
            throw new ApiError(404, "Connects balance not found.");
        await transaction.insert(connects_history).values({
            connects_id: balance.id,
            type: "Interview started refund",
            description: proposal.jobTitle,
            amount: PROPOSAL_CONNECTS,
        });
        return {
            conversationId: conversation.id,
            proposalId: proposal.id,
            senderType: proposal.senderType,
            freelancerId: proposal.freelancerId,
            jobTitle: proposal.jobTitle,
            connects: balance.connects,
        };
    });
    try {
        await redis.setEx(result.senderType === "AGENCY"
            ? getAgencyConnectsCacheKey(result.freelancerId)
            : getConnectsCacheKey(result.freelancerId), CONNECTS_CACHE_TTL_SECONDS, String(result.connects));
    }
    catch (error) {
        console.error("Failed to update connects cache after interview:", error);
    }
    return result;
};
//# sourceMappingURL=proposals.service.js.map
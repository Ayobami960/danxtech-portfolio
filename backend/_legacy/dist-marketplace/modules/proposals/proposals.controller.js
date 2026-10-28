import { asyncHandler } from "../../utils/async-handler.js";
import { requireFreelancer } from "../freelancer/freelancer.controller.js";
import { PROPOSAL_STATUSES, requireText } from "../../config/constants.js";
import { ApiError } from "../../utils/api-error.js";
import { getClientJobProposals, getFreelancerProposalMetadata, getFreelancerProposals, startProposalInterview, submitProposal, updateProposal } from "./proposals.service.js";
import { sendNotification } from "../../events/publisher.js";
export const requireClient = (request) => {
    if (!request.auth)
        throw new ApiError(401, "Authentication is required.");
    if (request.auth.role !== "client") {
        throw new ApiError(403, "A client account is required.");
    }
    return request.auth;
};
// The dashboard sends either { status } or { isShortlisted }.
const resolveTargetStatus = (body) => {
    if (typeof body?.status === "string") {
        const status = body.status.toUpperCase();
        if (!PROPOSAL_STATUSES.includes(status)) {
            throw new ApiError(400, "Invalid proposal status.");
        }
        return status;
    }
    if (typeof body?.isShortlisted === "boolean") {
        return body.isShortlisted ? "SHORTLISTED" : "VIEWED";
    }
    throw new ApiError(400, "A status is required.");
};
const notificationFor = (status, jobTitle, note) => {
    const suffix = note ? ` Note from the client: ${note}` : "";
    switch (status) {
        case "VIEWED":
            return { type: "PROPOSAL_VIEWED", title: "Your proposal was viewed",
                message: `A client viewed your proposal for “${jobTitle}”.` };
        case "SHORTLISTED":
            return { type: "PROPOSAL_SHORTLISTED", title: "You were shortlisted",
                message: `You were shortlisted for “${jobTitle}”.` };
        case "INTERVIEWED":
            return { type: "PROPOSAL_INTERVIEW", title: "Interview started",
                message: `A client wants to interview you for “${jobTitle}”.` };
        case "OFFER_SENT":
            return { type: "PROPOSAL_OFFER", title: "You received an offer",
                message: `A client is preparing a contract offer for “${jobTitle}”.` };
        case "REJECTED":
            return { type: "PROPOSAL_REJECTED", title: "Proposal declined",
                message: `Your proposal for “${jobTitle}” was declined.${suffix}` };
        case "HIRED":
            return { type: "PROPOSAL_HIRED", title: "You were hired",
                message: `You were hired for “${jobTitle}”.` };
    }
};
export const createProposal = asyncHandler(async (request, response) => {
    const auth = requireFreelancer(request);
    const coverLetter = requireText(request.body?.coverLetter, "Cover letter");
    const bidAmount = Number(request.body?.bidAmount);
    const screeningAnswers = Array.isArray(request.body?.screeningAnswers)
        ? request.body.screeningAnswers.map((answer) => typeof answer === "string" ? answer.trim() : "")
        : [];
    if (coverLetter.length < 80)
        throw new ApiError(400, "Cover letter must be at least 80 characters.");
    if (!Number.isFinite(bidAmount) ||
        bidAmount <= 0 ||
        bidAmount > 1_000_000) {
        throw new ApiError(400, "Enter a valid bid amount.");
    }
    const result = await submitProposal(auth.userId, {
        jobId: requireText(request.body?.jobId, "Job post"),
        coverLetter,
        bidAmount,
        duration: requireText(request.body?.duration, "Delivery duration"),
        screeningAnswers,
    });
    response.status(201).json({ success: true, message: "Proposal submitted.", data: result });
});
export const getProposalMetadata = asyncHandler(async (request, response) => {
    const auth = requireFreelancer(request);
    const metadata = await getFreelancerProposalMetadata(auth.userId);
    response.status(200).json({
        success: true,
        message: "Proposal metadata retrieved.",
        data: metadata,
    });
});
export const getProposals = asyncHandler(async (request, response) => {
    if (!request.auth)
        throw new ApiError(401, "Authentication is required.");
    const proposals = request.auth.role === "client"
        ? await getClientJobProposals(request.auth.userId, requireText(request.query.jobId, "Job post"))
        : await getFreelancerProposals(request.auth.userId);
    response.status(200).json({
        success: true,
        message: "Proposals retrieved.",
        data: proposals,
    });
});
export const updateProposalStatus = asyncHandler(async (request, response) => {
    const auth = requireClient(request);
    const target = resolveTargetStatus(request.body);
    const note = typeof request.body?.note === "string" ? request.body.note.trim() : "";
    const proposalId = requireText(request.params.proposalId, "Proposal");
    const proposal = await updateProposal(proposalId, auth.userId, target);
    if (proposal.changed) {
        const notification = notificationFor(target, proposal.jobTitle, note);
        try {
            await sendNotification({
                recipientId: proposal.senderId,
                ...notification,
                link: "/my-proposals",
                metadata: { proposalId: proposal.id },
            });
        }
        catch (error) {
            // The status change is already saved, so don't fail the request.
            console.error("Failed to send proposal notification:", error);
        }
    }
    response.status(200).json({
        success: true,
        message: proposal.changed ? "Proposal updated." : "Proposal unchanged.",
        data: proposal,
    });
});
export const interviewProposal = asyncHandler(async (request, response) => {
    if (!request.auth || request.auth.role !== "client") {
        throw new ApiError(403, "A client account is required.");
    }
    const message = requireText(request.body?.message, "Interview message");
    if (message.length > 5_000) {
        throw new ApiError(400, "Interview message cannot exceed 5,000 characters.");
    }
    const result = await startProposalInterview(requireText(request.params.proposalId, "Proposal"), request.auth.userId, message);
    // The interview already exists at this point; a notification failure must
    // not turn a successful request into a 500.
    try {
        await sendNotification(result.senderType === "AGENCY"
            ? {
                agencyId: result.freelancerId,
                type: "PROPOSAL_INTERVIEWED",
                title: "You received an interview",
                message: `A client started an interview for “${result.jobTitle}”.`,
                link: `/messages?conversationId=${result.conversationId}`,
                metadata: {
                    proposalId: result.proposalId,
                    conversationId: result.conversationId,
                },
            }
            : {
                recipientId: result.freelancerId,
                type: "PROPOSAL_INTERVIEWED",
                title: "You received an interview",
                message: `A client started an interview for “${result.jobTitle}”.`,
                link: `/messages?conversationId=${result.conversationId}`,
                metadata: {
                    proposalId: result.proposalId,
                    conversationId: result.conversationId,
                },
            });
    }
    catch (error) {
        console.error("Failed to send interview notification:", error);
    }
    response.status(201).json({
        success: true,
        message: "Interview started.",
        data: result,
    });
});
//# sourceMappingURL=proposals.controller.js.map
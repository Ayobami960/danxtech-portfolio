import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import { requireText } from "../../config/constants.js";
import { cancelAgencyInvitation, createAgency, getAgencyEarningsOverview, getAgencyForMember, getAgencyIdentityForOwner, getAgencyIdForMember, getAgencyInvitations, getAgencyMonthlyEarnings, getAgencyOwnerVerification, getAgencyPayoutManagementUrl, getAgencyTags, getMyAgencyInvitations, getPublicAgencyProfile, inviteAgencyMember, removeAgencyMember, resendAgencyInvitation, respondToAgencyInvitation, searchPublicAgencies, updateAgencyInvitationRole, updateAgencyMemberRole, updateAgencyProfile, } from "./agency.service.js";
import { getMatchedJobPostsBySkills, } from "../freelancer/freelancer.service.js";
import { createAgencyConnectsCheckout, getAgencyConnectsBalance, getAgencyConnectsHistory, } from "../connects/connects.service.js";
import { CONNECTS_PLANS } from "../../config/constants.js";
import { getAgencyProposalMetadata, getAgencyProposals, submitAgencyProposal, } from "../proposals/proposals.service.js";
const requireAgencyWebsite = (value) => {
    if (!value || !value.trim())
        return undefined;
    try {
        const url = new URL(value.trim());
        if (url.protocol !== "https:")
            throw new Error("Unsupported protocol.");
    }
    catch (error) {
        throw new ApiError(400, "Agency website must be a valid HTTPS URL.");
    }
    return value.trim();
};
const parseTags = (value) => {
    if (!Array.isArray(value))
        return [];
    return value
        .filter((tag) => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter(Boolean);
};
const parseImageInput = (value) => {
    if (!value || typeof value !== "object")
        return undefined;
    const url = value.url;
    if (typeof url !== "string" || !url.trim())
        return undefined;
    // With `exactOptionalPropertyTypes`, an optional property must be omitted
    // rather than set to `undefined`.
    const imageId = value.imageId;
    return typeof imageId === "string" && imageId
        ? { url, imageId }
        : { url };
};
const parsePortfolio = (value) => {
    if (!Array.isArray(value))
        return [];
    return value.map((rawItem, index) => {
        const item = rawItem;
        const coverImage = parseImageInput(item.coverImage);
        if (!coverImage) {
            throw new ApiError(400, `Portfolio project ${index + 1} needs a cover image.`);
        }
        const liveUrl = typeof item.liveUrl === "string" ? item.liveUrl.trim() : "";
        return {
            title: requireText(typeof item.title === "string" ? item.title : undefined, `Portfolio project ${index + 1} title`),
            category: requireText(typeof item.category === "string" ? item.category : undefined, `Portfolio project ${index + 1} category`),
            description: requireText(typeof item.description === "string" ? item.description : undefined, `Portfolio project ${index + 1} description`),
            ...(liveUrl ? { liveUrl } : {}),
            coverImage,
        };
    });
};
export const getLoggedInAgency = asyncHandler(async (request, response) => {
    if (!request.auth) {
        throw new ApiError(401, "Authentication is required.");
    }
    if (request.auth.role !== "freelancer") {
        throw new ApiError(403, "A freelancer account is required.");
    }
    const agency = await getAgencyForMember(request.auth.userId);
    const body = {
        success: true,
        message: agency ? "Agency retrieved." : "No agency found for this account.",
        data: agency,
    };
    response.status(200).json(body);
});
export const createAgencyHandler = asyncHandler(async (request, response) => {
    if (!request.auth) {
        throw new ApiError(401, "Authentication is required.");
    }
    if (request.auth.role !== "freelancer") {
        throw new ApiError(403, "A freelancer account is required.");
    }
    const body = request.body;
    const website = requireAgencyWebsite(body.website);
    const agency = await createAgency({
        ownerId: request.auth.userId,
        name: requireText(body.name, "Agency name"),
        size: requireText(body.size, "Agency size"),
        specialty: requireText(body.specialty, "Primary specialty"),
        ...(website ? { website } : {}),
        overview: requireText(body.overview, "Agency overview"),
    });
    const responseBody = {
        success: true,
        message: "Agency created.",
        data: agency,
    };
    response.status(201).json(responseBody);
});
export const updateAgencyHandler = asyncHandler(async (request, response) => {
    if (!request.auth) {
        throw new ApiError(401, "Authentication is required.");
    }
    if (request.auth.role !== "freelancer") {
        throw new ApiError(403, "A freelancer account is required.");
    }
    const body = request.body;
    const website = requireAgencyWebsite(body.website);
    const avatarImage = parseImageInput(body.avatarImage);
    const agency = await updateAgencyProfile({
        ownerId: request.auth.userId,
        name: requireText(body.name, "Agency name"),
        professionalTitle: requireText(body.professionalTitle, "Profile title"),
        size: requireText(body.size, "Agency size"),
        specialty: requireText(body.specialty, "Primary specialty"),
        ...(website ? { website } : {}),
        overview: requireText(body.overview, "Profile description"),
        tags: parseTags(body.tags),
        ...(avatarImage ? { avatarImage } : {}),
        portfolio: parsePortfolio(body.portfolio),
    });
    const responseBody = {
        success: true,
        message: "Agency profile saved.",
        data: agency,
    };
    response.status(200).json(responseBody);
});
export const getAgencyJobFeed = asyncHandler(async (request, response) => {
    if (!request.auth) {
        throw new ApiError(401, "Authentication is required.");
    }
    if (request.auth.role !== "freelancer") {
        throw new ApiError(403, "A freelancer account is required.");
    }
    const tags = await getAgencyTags(request.auth.userId);
    if (tags === null) {
        throw new ApiError(404, "No agency workspace was found for this account.");
    }
    const list = (value) => typeof value === "string" ? value.split(",").filter(Boolean) : undefined;
    const number = (value) => {
        const parsed = Number(value);
        return value !== undefined && Number.isFinite(parsed)
            ? parsed
            : undefined;
    };
    const filters = {
        sort: request.query.filter === "recent" ? "recent" : "best-match",
        levels: list(request.query.levels),
        durations: list(request.query.durations),
        minBudget: number(request.query.minBudget),
        maxBudget: number(request.query.maxBudget),
        minProposals: number(request.query.minProposals),
        maxProposals: number(request.query.maxProposals),
        paymentVerified: request.query.paymentVerified === "true",
    };
    const jobs = await getMatchedJobPostsBySkills(tags, filters);
    response.status(200).json({
        success: true,
        message: filters.sort === "recent"
            ? "Recent job posts retrieved."
            : "Matched job posts retrieved.",
        data: jobs,
    });
});
export const getAgencyConnects = asyncHandler(async (request, response) => {
    if (!request.auth) {
        throw new ApiError(401, "Authentication is required.");
    }
    if (request.auth.role !== "freelancer") {
        throw new ApiError(403, "A freelancer account is required.");
    }
    const agencyId = await getAgencyIdForMember(request.auth.userId);
    if (!agencyId) {
        throw new ApiError(404, "No agency workspace was found for this account.");
    }
    const connects = await getAgencyConnectsBalance(agencyId);
    const body = {
        success: true,
        message: "Agency Connects balance retrieved.",
        data: { connects },
    };
    response.status(200).json(body);
});
export const getAgencyConnectsHistoryHandler = asyncHandler(async (request, response) => {
    if (!request.auth) {
        throw new ApiError(401, "Authentication is required.");
    }
    if (request.auth.role !== "freelancer") {
        throw new ApiError(403, "A freelancer account is required.");
    }
    const agencyId = await getAgencyIdForMember(request.auth.userId);
    const history = agencyId ? await getAgencyConnectsHistory(agencyId) : [];
    const body = {
        success: true,
        message: "Agency Connects history retrieved.",
        data: history,
    };
    response.status(200).json(body);
});
export const buyAgencyConnects = asyncHandler(async (request, response) => {
    if (!request.auth) {
        throw new ApiError(401, "Authentication is required.");
    }
    if (request.auth.role !== "freelancer") {
        throw new ApiError(403, "A freelancer account is required.");
    }
    const agencyId = await getAgencyIdForMember(request.auth.userId);
    if (!agencyId) {
        throw new ApiError(404, "No agency workspace was found for this account.");
    }
    const purchasedConnects = Number(request.body?.connects);
    if (!(purchasedConnects in CONNECTS_PLANS)) {
        throw new ApiError(400, "Select a valid Connects package.");
    }
    const url = await createAgencyConnectsCheckout(request.auth.userId, agencyId, purchasedConnects);
    const body = {
        success: true,
        message: "Stripe Checkout created.",
        data: { url },
    };
    response.status(200).json(body);
});
export const submitAgencyProposalHandler = asyncHandler(async (request, response) => {
    if (!request.auth) {
        throw new ApiError(401, "Authentication is required.");
    }
    if (request.auth.role !== "freelancer") {
        throw new ApiError(403, "A freelancer account is required.");
    }
    const agencyId = await getAgencyIdForMember(request.auth.userId);
    if (!agencyId) {
        throw new ApiError(404, "No agency workspace was found for this account.");
    }
    const coverLetter = requireText(request.body?.coverLetter, "Cover letter");
    const bidAmount = Number(request.body?.bidAmount);
    const screeningAnswers = Array.isArray(request.body?.screeningAnswers)
        ? request.body.screeningAnswers.map((answer) => typeof answer === "string" ? answer.trim() : "")
        : [];
    if (coverLetter.length < 80) {
        throw new ApiError(400, "Cover letter must be at least 80 characters.");
    }
    if (!Number.isFinite(bidAmount) || bidAmount <= 0 || bidAmount > 1_000_000) {
        throw new ApiError(400, "Enter a valid bid amount.");
    }
    const result = await submitAgencyProposal(agencyId, {
        jobId: requireText(request.body?.jobId, "Job post"),
        coverLetter,
        bidAmount,
        duration: requireText(request.body?.duration, "Delivery duration"),
        screeningAnswers,
    });
    const body = {
        success: true,
        message: "Proposal submitted.",
        data: result,
    };
    response.status(201).json(body);
});
export const getPublicAgencyHandler = asyncHandler(async (request, response) => {
    const profile = await getPublicAgencyProfile(requireText(request.params.id, "Agency"));
    if (!profile)
        throw new ApiError(404, "Agency profile not found.");
    const body = {
        success: true,
        message: "Agency profile retrieved.",
        data: profile,
    };
    response.status(200).json(body);
});
const AGENCY_SORT_VALUES = ["recommended", "rating", "projects", "rate-low"];
export const searchPublicAgenciesHandler = asyncHandler(async (request, response) => {
    const query = typeof request.query.query === "string" ? request.query.query : "";
    const sort = typeof request.query.sort === "string" &&
        AGENCY_SORT_VALUES.includes(request.query.sort)
        ? request.query.sort
        : "recommended";
    const offset = Math.max(0, Number(request.query.offset) || 0);
    const sizes = typeof request.query.sizes === "string" && request.query.sizes
        ? request.query.sizes.split(",").filter(Boolean)
        : undefined;
    const maxRate = Number(request.query.maxRate);
    const filters = {
        query,
        sort,
        ...(sizes ? { sizes } : {}),
        ...(typeof request.query.specialty === "string" && request.query.specialty
            ? { specialty: request.query.specialty }
            : {}),
        verifiedOnly: request.query.verifiedOnly === "true",
        ...(Number.isFinite(maxRate) && maxRate > 0 ? { maxRate } : {}),
    };
    const page = await searchPublicAgencies(filters, { offset });
    const responseBody = {
        success: true,
        message: "Agency search results retrieved.",
        data: page,
    };
    response.status(200).json(responseBody);
});
export const getAgencyProposalMetadataHandler = asyncHandler(async (request, response) => {
    if (!request.auth) {
        throw new ApiError(401, "Authentication is required.");
    }
    if (request.auth.role !== "freelancer") {
        throw new ApiError(403, "A freelancer account is required.");
    }
    const agencyId = await getAgencyIdForMember(request.auth.userId);
    const metadata = agencyId
        ? await getAgencyProposalMetadata(agencyId)
        : { proposals: [], counts: { total: 0, active: 0, viewed: 0, interviewed: 0 } };
    const body = {
        success: true,
        message: "Proposal metadata retrieved.",
        data: metadata,
    };
    response.status(200).json(body);
});
export const getAgencyProposalsHandler = asyncHandler(async (request, response) => {
    if (!request.auth) {
        throw new ApiError(401, "Authentication is required.");
    }
    if (request.auth.role !== "freelancer") {
        throw new ApiError(403, "A freelancer account is required.");
    }
    const agencyId = await getAgencyIdForMember(request.auth.userId);
    const proposals = agencyId ? await getAgencyProposals(agencyId) : [];
    const body = {
        success: true,
        message: "Proposals retrieved.",
        data: proposals,
    };
    response.status(200).json(body);
});
export const getAgencyEarningsSummaryHandler = asyncHandler(async (request, response) => {
    if (!request.auth) {
        throw new ApiError(401, "Authentication is required.");
    }
    if (request.auth.role !== "freelancer") {
        throw new ApiError(403, "A freelancer account is required.");
    }
    const agencyId = await getAgencyIdForMember(request.auth.userId);
    const earnings = agencyId
        ? await getAgencyMonthlyEarnings(agencyId)
        : {
            hasEarnings: false,
            currentMonthTotal: 0,
            previousMonthTotal: 0,
            series: [],
        };
    const body = {
        success: true,
        message: "Agency earnings summary retrieved.",
        data: earnings,
    };
    response.status(200).json(body);
});
const requireAgencyAuth = (request) => {
    if (!request.auth)
        throw new ApiError(401, "Authentication is required.");
    if (request.auth.role !== "freelancer") {
        throw new ApiError(403, "A freelancer account is required.");
    }
    return request.auth;
};
const requireAgencyOwner = async (userId) => {
    const agency = await getAgencyIdentityForOwner(userId);
    if (!agency) {
        throw new ApiError(403, "Only the agency owner can manage the team.");
    }
    return agency;
};
export const getAgencyEarningsOverviewHandler = asyncHandler(async (request, response) => {
    const auth = requireAgencyAuth(request);
    const agencyId = await getAgencyIdForMember(auth.userId);
    const overview = agencyId
        ? await getAgencyEarningsOverview(agencyId)
        : {
            available: 0,
            pending: 0,
            withdrawn: 0,
            lifetime: 0,
            totalFees: 0,
            recentEarnings: [],
        };
    const body = {
        success: true,
        message: "Agency earnings overview retrieved.",
        data: overview,
    };
    response.status(200).json(body);
});
export const getAgencyPayoutManagementLinkHandler = asyncHandler(async (request, response) => {
    const auth = requireAgencyAuth(request);
    const agency = await getAgencyIdentityForOwner(auth.userId);
    if (!agency) {
        throw new ApiError(403, "Only the agency owner can manage payout settings.");
    }
    const url = await getAgencyPayoutManagementUrl(agency.id);
    const body = {
        success: true,
        message: "Stripe payout management link created.",
        data: { url },
    };
    response.status(200).json(body);
});
export const getAgencyTeamInvitationsHandler = asyncHandler(async (request, response) => {
    const auth = requireAgencyAuth(request);
    const agencyId = await getAgencyIdForMember(auth.userId);
    const invitations = agencyId ? await getAgencyInvitations(agencyId) : [];
    response.status(200).json({
        success: true,
        message: "Agency invitations retrieved.",
        data: invitations,
    });
});
export const inviteAgencyMemberHandler = asyncHandler(async (request, response) => {
    const auth = requireAgencyAuth(request);
    const agency = await requireAgencyOwner(auth.userId);
    const email = requireText(request.body?.email, "Email").toLowerCase();
    const role = request.body?.memberRole === "Business manager"
        ? "Business manager"
        : "Agency member";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new ApiError(400, "Enter a valid email address.");
    }
    const invitation = await inviteAgencyMember(agency.id, agency.name, auth.userId, {
        email,
        role,
    });
    response.status(201).json({
        success: true,
        message: "Invitation sent.",
        data: invitation,
    });
});
export const cancelAgencyInvitationHandler = asyncHandler(async (request, response) => {
    const auth = requireAgencyAuth(request);
    const agency = await requireAgencyOwner(auth.userId);
    await cancelAgencyInvitation(agency.id, requireText(request.params.invitationId, "Invitation"));
    response.status(200).json({
        success: true,
        message: "Invitation cancelled.",
        data: null,
    });
});
export const updateAgencyInvitationRoleHandler = asyncHandler(async (request, response) => {
    const auth = requireAgencyAuth(request);
    const agency = await requireAgencyOwner(auth.userId);
    const role = request.body?.memberRole === "Business manager"
        ? "Business manager"
        : "Agency member";
    await updateAgencyInvitationRole(agency.id, requireText(request.params.invitationId, "Invitation"), role);
    response.status(200).json({
        success: true,
        message: "Invitation role updated.",
        data: null,
    });
});
export const resendAgencyInvitationHandler = asyncHandler(async (request, response) => {
    const auth = requireAgencyAuth(request);
    const agency = await requireAgencyOwner(auth.userId);
    const result = await resendAgencyInvitation(agency.id, requireText(request.params.invitationId, "Invitation"), agency.name);
    response.status(200).json({
        success: true,
        message: "Invitation resent.",
        data: result,
    });
});
export const updateAgencyMemberRoleHandler = asyncHandler(async (request, response) => {
    const auth = requireAgencyAuth(request);
    const agency = await requireAgencyOwner(auth.userId);
    const role = request.body?.memberRole === "Business manager"
        ? "Business manager"
        : "Agency member";
    await updateAgencyMemberRole(agency.id, requireText(request.params.memberId, "Member"), role);
    response.status(200).json({
        success: true,
        message: "Member role updated.",
        data: null,
    });
});
export const removeAgencyMemberHandler = asyncHandler(async (request, response) => {
    const auth = requireAgencyAuth(request);
    const agency = await requireAgencyOwner(auth.userId);
    await removeAgencyMember(agency.id, requireText(request.params.memberId, "Member"));
    response.status(200).json({
        success: true,
        message: "Member removed.",
        data: null,
    });
});
export const getMyAgencyInvitationsHandler = asyncHandler(async (request, response) => {
    const auth = requireAgencyAuth(request);
    const invitations = await getMyAgencyInvitations(auth.userId);
    response.status(200).json({
        success: true,
        message: "Your agency invitations were retrieved.",
        data: invitations,
    });
});
export const respondToAgencyInvitationHandler = asyncHandler(async (request, response) => {
    const auth = requireAgencyAuth(request);
    const accept = request.body?.accept;
    if (typeof accept !== "boolean") {
        throw new ApiError(400, "An accept decision is required.");
    }
    const result = await respondToAgencyInvitation(requireText(request.params.invitationId, "Invitation"), auth.userId, accept);
    response.status(200).json({
        success: true,
        message: accept ? "Invitation accepted." : "Invitation declined.",
        data: result,
    });
});
export const getAgencyMembershipHandler = asyncHandler(async (request, response) => {
    const auth = requireAgencyAuth(request);
    const agencyId = await getAgencyIdForMember(auth.userId);
    response.status(200).json({
        success: true,
        message: "Agency membership retrieved.",
        data: { agencyId },
    });
});
export const getAgencyVerificationHandler = asyncHandler(async (request, response) => {
    const auth = requireAgencyAuth(request);
    const agencyId = await getAgencyIdForMember(auth.userId);
    const owner = agencyId ? await getAgencyOwnerVerification(agencyId) : null;
    const data = {
        identityVerified: owner?.identityVerified ?? false,
        isOwner: Boolean(owner && owner.ownerId === auth.userId),
    };
    response.status(200).json({
        success: true,
        message: "Agency verification status retrieved.",
        data,
    });
});
//# sourceMappingURL=agency.controller.js.map
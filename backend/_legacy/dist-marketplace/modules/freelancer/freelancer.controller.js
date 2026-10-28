import { ApiError } from "../../utils/api-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getFreelancerEarningsCertificateData, getFreelancerEarningsOverview, getFreelancerJobPost, getFreelancerMonthlyEarnings, getFreelancerPayoutManagementUrl, getFreelancerProfile, getMatchedJobPosts, getPublicFreelancerProfile, saveFreelancerProfile, searchPublicFreelancers, } from "./freelancer.service.js";
import { renderEarningsCertificatePdf } from "./earnings-certificate.pdf.js";
import { requireText } from "../../config/constants.js";
import { env } from "../../config/env.js";
export const requireFreelancer = (request) => {
    if (!request.auth)
        throw new ApiError(401, "Authentication is required.");
    if (request.auth.role !== "freelancer") {
        throw new ApiError(403, "A freelancer account is required.");
    }
    return request.auth;
};
const { maxPortfolioProjects: MAX_PORTFOLIO_PROJECTS, maxSkills: MAX_SKILLS, minSkills: MIN_SKILLS, maxLanguages: MAX_LANGUAGES, maxSkillLength: MAX_SKILL_LENGTH, maxTextLength: MAX_TEXT_LENGTH, maxDescriptionLength: MAX_DESCRIPTION_LENGTH, maxPortfolioDescriptionLength: MAX_PORTFOLIO_DESCRIPTION_LENGTH, maxBase64ImageBytes: MAX_BASE64_IMAGE_BYTES, } = env.freelancerProfile;
const AVAILABILITY_STATUSES = ["AVAILABLE", "LIMITED", "UNAVAILABLE"];
const WEEKLY_AVAILABILITY_OPTIONS = [
    "Less than 20 hours / week",
    "20–30 hours / week",
    "30+ hours / week",
];
const EXPERIENCE_LEVELS = ["Entry", "Intermediate", "Expert"];
const LANGUAGE_PROFICIENCIES = ["Conversational", "Fluent", "Native"];
const isEnumValue = (value, allowed) => typeof value === "string" && allowed.includes(value);
const requireEnum = (value, allowed, fieldName) => {
    if (!isEnumValue(value, allowed)) {
        throw new ApiError(400, `${fieldName} must be one of: ${allowed.join(", ")}.`);
    }
    return value;
};
const requireBoundedText = (value, fieldName, maxLength = MAX_TEXT_LENGTH) => {
    const text = requireText(typeof value === "string" ? value : undefined, fieldName);
    if (text.length > maxLength) {
        throw new ApiError(400, `${fieldName} must be at most ${maxLength} characters.`);
    }
    return text;
};
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
/** Rough decoded-size check so oversized images fail fast before hitting ImageKit. */
const parseBase64Image = (dataUrl) => {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match?.[2])
        return null;
    const base64Payload = match[2];
    const base64Length = base64Payload.length - (base64Payload.endsWith("==") ? 2 : base64Payload.endsWith("=") ? 1 : 0);
    const decodedBytes = Math.floor((base64Length * 3) / 4);
    return decodedBytes <= MAX_BASE64_IMAGE_BYTES ? dataUrl : null;
};
const parsePortfolioInput = (portfolios) => {
    if (!Array.isArray(portfolios) || portfolios.length < 1) {
        throw new ApiError(400, "At least one portfolio project is required.");
    }
    if (portfolios.length > MAX_PORTFOLIO_PROJECTS) {
        throw new ApiError(400, `A portfolio can contain at most ${MAX_PORTFOLIO_PROJECTS} projects.`);
    }
    return portfolios.map((item, index) => {
        if (!isRecord(item)) {
            throw new ApiError(400, `Portfolio project ${index + 1} is invalid.`);
        }
        const label = `Portfolio project ${index + 1}`;
        const coverImage = item.cover_image;
        if (!isRecord(coverImage)) {
            throw new ApiError(400, `${label}: a cover image is required.`);
        }
        const imageId = typeof coverImage.imageId === "string" ? coverImage.imageId.trim() : "";
        const imageUrl = requireText(typeof coverImage.url === "string" ? coverImage.url : undefined, `${label} cover image URL`);
        /*
         * The frontend only ever sends either a fresh data-URL image (new upload)
         * or an existing image untouched (imageId + hosted URL). Anything else is
         * untrusted, so require the data-URL form for anything without an imageId.
         */
        if (!imageId && !parseBase64Image(imageUrl)) {
            throw new ApiError(400, `${label}: the cover image is invalid or too large (max 5 MB).`);
        }
        const liveUrl = typeof item.live_url === "string" && item.live_url.trim()
            ? item.live_url.trim()
            : null;
        if (liveUrl) {
            try {
                const url = new URL(liveUrl);
                if (url.protocol !== "https:" && url.protocol !== "http:") {
                    throw new Error("Unsupported protocol.");
                }
            }
            catch {
                throw new ApiError(400, `${label}: the live link must be a valid URL.`);
            }
        }
        return {
            title: requireBoundedText(item.title, `${label} title`),
            category: requireBoundedText(item.category, `${label} category`),
            description: requireBoundedText(item.description, `${label} description`, MAX_PORTFOLIO_DESCRIPTION_LENGTH),
            live_url: liveUrl,
            cover_image: { imageId, url: imageUrl },
        };
    });
};
export const getLoggedInFreelancerProfileHandler = asyncHandler(async (request, response) => {
    const auth = requireFreelancer(request);
    const profile = await getFreelancerProfile(auth.userId);
    const body = {
        success: true,
        message: profile
            ? "Freelancer profile retrieved."
            : "Freelancer profile has not been completed.",
        data: profile,
    };
    return response.status(200).json(body);
});
export const upsertFreelanceProfile = asyncHandler(async (request, response) => {
    const auth = requireFreelancer(request);
    const body = request.body;
    if (!isRecord(body)) {
        throw new ApiError(400, "A request body is required.");
    }
    const metadata = body.freelancer_metadata;
    if (!isRecord(metadata)) {
        throw new ApiError(400, "Freelancer metadata is required.");
    }
    const portfolios = parsePortfolioInput(body.freelancer_portfolios);
    const hourlyRate = Number(metadata.hourly_rate);
    if (!Number.isFinite(hourlyRate) || hourlyRate < 5 || hourlyRate > 1000) {
        throw new ApiError(400, "Hourly rate must be between 5 and 1000.");
    }
    const skills = metadata.skills;
    if (!Array.isArray(skills) ||
        skills.length < MIN_SKILLS ||
        skills.length > MAX_SKILLS ||
        skills.some((skill) => typeof skill !== "string" || !skill.trim() || skill.trim().length > MAX_SKILL_LENGTH)) {
        throw new ApiError(400, `Add ${MIN_SKILLS} to ${MAX_SKILLS} skills with at most ${MAX_SKILL_LENGTH} characters each.`);
    }
    const languages = metadata.languages;
    if (!Array.isArray(languages) || languages.length < 1 || languages.length > MAX_LANGUAGES) {
        throw new ApiError(400, `Add between 1 and ${MAX_LANGUAGES} languages.`);
    }
    const existingProfile = await getFreelancerProfile(auth.userId);
    // Accept avatarUrl from either the top-level body (client convention) or
    // from inside freelancer_metadata, matching the client-dashboard pattern.
    const avatarUrl = typeof body.avatarUrl === "string" && body.avatarUrl.trim()
        ? body.avatarUrl.trim()
        : typeof metadata.avatarUrl === "string" && metadata.avatarUrl.trim()
            ? metadata.avatarUrl.trim()
            : existingProfile?.avatarUrl ?? "";
    const input = {
        userId: auth.userId,
        professional_title: requireBoundedText(metadata.professional_title, "Professional title"),
        professional_description: requireBoundedText(metadata.professional_description, "Professional description", MAX_DESCRIPTION_LENGTH),
        hourly_rate: hourlyRate.toFixed(2),
        country: requireBoundedText(metadata.country, "Country", 56),
        city: requireBoundedText(metadata.city, "City", 85),
        availability_status: requireEnum(metadata.availability_status, AVAILABILITY_STATUSES, "Availability status"),
        weekly_availability: requireEnum(metadata.weekly_availability, WEEKLY_AVAILABILITY_OPTIONS, "Weekly availability"),
        experience_level: requireEnum(metadata.experience_level, EXPERIENCE_LEVELS, "Experience level"),
        skills: [...new Set(skills.map((skill) => String(skill).trim()))],
        languages: languages.map((item, index) => {
            if (!isRecord(item)) {
                throw new ApiError(400, `Language ${index + 1} is invalid.`);
            }
            return {
                language: requireBoundedText(item.language, `Language ${index + 1}`, 58),
                proficiency: requireEnum(item.proficiency, LANGUAGE_PROFICIENCIES, `Language ${index + 1} proficiency`),
            };
        }),
        portfolios,
        avatarUrl,
    };
    const profile = await saveFreelancerProfile(input);
    const responseBody = {
        success: true,
        message: "Freelancer profile saved.",
        data: profile,
    };
    return response.status(200).json(responseBody);
});
export const getFreelancerEarningsSummary = asyncHandler(async (request, response) => {
    const auth = requireFreelancer(request);
    const earnings = await getFreelancerMonthlyEarnings(auth.userId);
    response.status(200).json({
        success: true,
        message: "Freelancer earnings summary retrieved.",
        data: earnings,
    });
});
export const getFreelancerEarningsOverviewHandler = asyncHandler(async (request, response) => {
    const auth = requireFreelancer(request);
    const overview = await getFreelancerEarningsOverview(auth.userId);
    response.status(200).json({
        success: true,
        message: "Freelancer earnings overview retrieved.",
        data: overview,
    });
});
export const getFreelancerEarningsCertificate = asyncHandler(async (request, response) => {
    const auth = requireFreelancer(request);
    const data = await getFreelancerEarningsCertificateData(auth.userId);
    const pdf = await renderEarningsCertificatePdf(data);
    const fileName = `OneMarketplace-Earnings-Certificate-${data.issuedAt
        .toISOString()
        .slice(0, 10)}.pdf`;
    response
        .status(200)
        .setHeader("Content-Type", "application/pdf")
        .setHeader("Content-Disposition", `attachment; filename="${fileName}"`)
        .send(pdf);
});
export const getFreelancerPayoutManagementLink = asyncHandler(async (request, response) => {
    const auth = requireFreelancer(request);
    const url = await getFreelancerPayoutManagementUrl(auth.userId);
    response.status(200).json({
        success: true,
        message: "Stripe payout management link created.",
        data: { url },
    });
});
export const getFreelancerJobFeed = asyncHandler(async (request, response) => {
    const auth = requireFreelancer(request);
    const list = (value) => typeof value === "string" ? value.split(",").filter(Boolean) : undefined;
    const number = (value) => {
        if (value === undefined || value === "")
            return undefined;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    };
    const filters = {
        sort: (request.query.sort ?? request.query.filter) === "recent" ? "recent" : "best-match",
        levels: list(request.query.levels),
        durations: list(request.query.durations),
        minBudget: number(request.query.minBudget),
        maxBudget: number(request.query.maxBudget),
        minProposals: number(request.query.minProposals),
        maxProposals: number(request.query.maxProposals),
        paymentVerified: request.query.paymentVerified === "true",
    };
    const jobs = await getMatchedJobPosts(auth.userId, filters);
    response.status(200).json({
        success: true,
        message: filters.sort === "recent"
            ? "Recent job posts retrieved."
            : "Matched job posts retrieved.",
        data: jobs,
    });
});
export const getFreelancerJobDetails = asyncHandler(async (request, response) => {
    requireFreelancer(request);
    const job = await getFreelancerJobPost(requireText(request.params.id, "Job ID"));
    response.status(200).json({
        success: true,
        message: "Job post retrieved",
        data: job
    });
});
export const getPublicFreelancer = asyncHandler(async (request, response) => {
    const profile = await getPublicFreelancerProfile(requireText(request.params.id, "Freelancer"));
    if (!profile)
        throw new ApiError(404, "Freelancer profile not found.");
    response.status(200).json({
        success: true,
        message: "Freelancer profile retrieved.",
        data: profile,
    });
});
const SORT_VALUES = ["recommended", "rating", "success", "projects", "rate-low"];
export const searchPublicFreelancersHandler = asyncHandler(async (request, response) => {
    const query = typeof request.query.query === "string" ? request.query.query : "";
    const sort = typeof request.query.sort === "string" &&
        SORT_VALUES.includes(request.query.sort)
        ? request.query.sort
        : "recommended";
    const offset = Math.max(0, Number(request.query.offset) || 0);
    const numberParam = (key) => {
        const value = Number(request.query[key]);
        return Number.isFinite(value) && value > 0 ? value : undefined;
    };
    const filters = {
        query,
        sort,
        verifiedOnly: request.query.verifiedOnly === "true",
        availableOnly: request.query.availableOnly === "true",
        minRating: numberParam("minRating"),
        minSuccess: numberParam("minSuccess"),
        minRate: numberParam("minRate"),
        maxRate: numberParam("maxRate"),
    };
    const page = await searchPublicFreelancers(filters, { offset });
    const responseBody = {
        success: true,
        message: "Talent search results retrieved.",
        data: page,
    };
    response.status(200).json(responseBody);
});
//# sourceMappingURL=freelancer.controller.js.map
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import { getClientProfile, saveClientProfile } from "./client.service.js";
import { requireText, requireWebsite } from "../../config/constants.js";
export const getLoggedInClientProfile = asyncHandler(async (request, response) => {
    if (!request.auth) {
        throw new ApiError(401, "Authentication is required.");
    }
    if (request.auth.role !== "client") {
        throw new ApiError(403, "A client account is required.");
    }
    const profile = await getClientProfile(request.auth.userId);
    const responseBody = {
        success: true,
        message: profile ? "Client profile retrieved" : "Client profile has not been completed",
        data: profile,
    };
    response.status(200).json(responseBody);
});
export const upsertClientProfile = asyncHandler(async (request, response) => {
    if (!request.auth) {
        throw new ApiError(401, "Authentication is required.");
    }
    if (request.auth.role !== "client") {
        throw new ApiError(403, "A client account is required");
    }
    const body = request.body;
    const avatarUrl = body.avatarUrl?.trim() ?? "";
    if (avatarUrl) {
        try {
            const url = new URL(avatarUrl);
            if (url.protocol !== "https:")
                throw new Error("Unsupported protocol.");
        }
        catch {
            throw new ApiError(400, "Profile photo URL must be a valid HTTPS URL.");
        }
    }
    const input = {
        userId: request.auth.userId,
        firstName: requireText(body.firstName, "First name"),
        lastName: requireText(body.lastName, "Last name"),
        country: requireText(body.country, "Country"),
        avatarUrl,
        professionalRole: requireText(body.professionalRole, "Professional role"),
        companyName: requireText(body.companyName, "Company name"),
        companyWebsite: requireWebsite(body.companyWebsite),
        companySize: requireText(body.companySize, "Company size"),
        industry: requireText(body.industry, "industry"),
        companyDescription: requireText(body.companyDescription, "Company description"),
    };
    const profile = await saveClientProfile(input);
    const responseBody = {
        success: true,
        message: "Client profile saved.",
        data: profile,
    };
    response.status(200).json(responseBody);
});
//# sourceMappingURL=client.controller.js.map
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { authenticateAccessToken, getCookieNames } from "../modules/auth/auth.service.js";
// my real code
const readCookie = (header, name) => {
    if (!header)
        return undefined;
    // Match the exact cookie name so `om_access_old` cannot shadow `om_access`.
    const item = header
        .split(";")
        .map((part) => part.trim())
        .find((part) => part === name || part.startsWith(`${name}=`));
    if (!item)
        return undefined;
    try {
        return decodeURIComponent(item.slice(name.length + 1));
    }
    catch {
        // A malformed percent-encoding is simply an unusable cookie.
        return undefined;
    }
};
const readAccessToken = (request) => {
    const cookieToken = readCookie(request.headers.cookie, getCookieNames().access);
    if (cookieToken)
        return cookieToken;
    const authorization = request.get("authorization");
    return authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() || undefined : undefined;
};
export const authenticate = asyncHandler(async (request, _response, next) => {
    const token = readAccessToken(request);
    if (!token)
        throw new ApiError(401, "Authentication is required.");
    request.auth = await authenticateAccessToken(token);
    next();
});
export const isAuthenticated = authenticate;
/**
 * Best-effort authentication: attaches the session when the request carries a
 * valid access token, but never rejects. `/auth/logout` uses it so a client
 * that only sends `Authorization: Bearer` still has its session revoked.
 */
export const authenticateOptional = asyncHandler(async (request, _response, next) => {
    const token = readAccessToken(request);
    if (token) {
        try {
            request.auth = await authenticateAccessToken(token);
        }
        catch {
            // An expired or invalid token here simply means "already signed out".
        }
    }
    next();
});
export const requireRole = (...roles) => (request, _response, next) => {
    if (!request.auth) {
        next(new ApiError(401, "Authentication is required."));
        return;
    }
    if (!roles.includes(request.auth.role)) {
        next(new ApiError(403, "This account does not have permission to access this resource."));
        return;
    }
    next();
};
/**
 * Blocks dashboard activities until the role profile has been saved.
 * `isOnboarded` is read from the accounts row on every authenticated
 * request, so enforcement follows the persisted server-side state.
 */
export const requireOnboarded = (request, _response, next) => {
    if (!request.auth) {
        next(new ApiError(401, "Authentication is required."));
        return;
    }
    if (!request.auth.isOnboarded) {
        next(new ApiError(403, "Complete your profile before accessing this resource."));
        return;
    }
    next();
};
//# sourceMappingURL=auth.middleware.js.map
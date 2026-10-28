import { CSRF_COOKIE } from "../config/constants.js";
import { constantTimeEqual } from "../lib/crypto.js";
import { isValidCsrfToken } from "../lib/csrf.js";
import { AppError, ERROR_CODES } from "../lib/errors.js";
/**
 * Double-submit cookie check: the value in the `X-CSRF-Token` header must match
 * the readable, HMAC-signed CSRF cookie. Applied to every non-GET request under
 * /api/admin and to /api/auth except login.
 */
export const requireCsrf = (request, _response, next) => {
    const cookieToken = request.cookies?.[CSRF_COOKIE];
    const headerToken = request.get("x-csrf-token");
    if (typeof cookieToken !== "string" ||
        !headerToken ||
        !constantTimeEqual(cookieToken, headerToken) ||
        !isValidCsrfToken(headerToken)) {
        next(new AppError(403, ERROR_CODES.CSRF_INVALID, "CSRF token is missing or invalid."));
        return;
    }
    next();
};
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
/**
 * Router-level variant: only state-changing requests need a CSRF token, so
 * reads stay simple while every mutation is protected automatically.
 */
export const requireCsrfForMutations = (request, response, next) => {
    if (SAFE_METHODS.has(request.method)) {
        next();
        return;
    }
    requireCsrf(request, response, next);
};
//# sourceMappingURL=csrf.js.map
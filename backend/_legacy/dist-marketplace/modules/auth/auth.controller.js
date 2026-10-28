import { ApiError } from "../../utils/api-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { env, isAllowedOrigin } from "../../config/env.js";
import { forgotPassword as sendPasswordReset, getCookieNames, getMe, getTokenTtls, login as authenticateAccount, refresh as rotateRefreshToken, register as createAccount, resendOtp as sendVerificationCode, resetPassword as updatePassword, revokeSession, revokeByRefreshToken, updateAccountProfile, verifyEmail as verifyAccountEmail, createHandoffCode, exchangeHandoffCode, } from "./auth.service.js";
/**
 * The browser never calls the API directly: each frontend proxies `/api/v1/*`
 * through its own origin, so these cookies are always first-party to the app
 * that holds them. That keeps them working on separate Vercel domains without a
 * shared `COOKIE_DOMAIN`, and lets us keep the safer `Lax` policy. `Secure` is
 * still required on HTTPS.
 */
const sameSiteForEnvironment = () => "lax";
export const sessionCookieOptions = (maxAge) => ({
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: sameSiteForEnvironment(),
    path: "/",
    maxAge: maxAge * 1000,
    ...(env.cookieDomain ? { domain: env.cookieDomain } : {}),
});
const requestContext = (request) => {
    const userAgent = request.get("user-agent");
    return {
        ...(request.ip ? { ip: request.ip } : {}),
        ...(userAgent ? { userAgent } : {}),
    };
};
const setTokenCookies = (response, tokens) => {
    const names = getCookieNames();
    const ttl = getTokenTtls();
    response.cookie(names.access, tokens.accessToken, sessionCookieOptions(ttl.access));
    response.cookie(names.refresh, tokens.refreshToken, sessionCookieOptions(ttl.refresh));
};
const tokenPayload = (tokens) => ({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenType: "Bearer",
    expiresIn: getTokenTtls().access,
});
const clearTokenCookies = (response) => {
    const names = getCookieNames();
    response.clearCookie(names.access, sessionCookieOptions(0));
    response.clearCookie(names.refresh, sessionCookieOptions(0));
};
const readCookie = (header, name) => {
    if (!header)
        return undefined;
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
        return undefined;
    }
};
const assertSafeOrigin = (request, _response, next) => {
    const origin = request.get("origin");
    if (origin && !isAllowedOrigin(origin)) {
        // Name the origin: silently rejecting it looks like "the session was
        // lost" on the dashboard, which is impossible to debug from the app.
        next(new ApiError(403, `Origin ${origin} is not allowed. Add it to ORIGINS_* or API_ALLOWED_ORIGINS.`));
        return;
    }
    next();
};
export const register = asyncHandler(async (request, response) => {
    const result = await createAccount(request.body);
    response.status(202).json({ success: true, message: result.message });
});
export const login = asyncHandler(async (request, response) => {
    const result = await authenticateAccount(request.body, requestContext(request));
    setTokenCookies(response, result.tokens);
    response.status(200).json({
        success: true,
        message: "Signed in.",
        data: { account: result.account, ...tokenPayload(result.tokens) },
    });
});
export const verifyEmail = asyncHandler(async (request, response) => {
    const result = await verifyAccountEmail(request.body, requestContext(request));
    setTokenCookies(response, result.tokens);
    response.status(200).json({
        success: true,
        message: "Email verified.",
        data: { account: result.account, ...tokenPayload(result.tokens) },
    });
});
export const resendOtp = asyncHandler(async (request, response) => {
    await sendVerificationCode(request.body.email);
    response.status(200).json({ success: true, message: "If the address requires verification, a code will be sent." });
});
const bodyRefreshToken = (request) => {
    const value = request.body?.refreshToken;
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
};
export const refresh = asyncHandler(async (request, response) => {
    // Cookie first (default for the browser), body second so a Bearer client
    // that cannot hold cookies can still rotate its session.
    const token = readCookie(request.headers.cookie, getCookieNames().refresh) ?? bodyRefreshToken(request);
    if (!token)
        throw new ApiError(401, "Refresh token is invalid or expired.", "TOKEN_INVALID");
    const tokens = await rotateRefreshToken(token, requestContext(request));
    setTokenCookies(response, tokens);
    response.status(200).json({
        success: true,
        message: "Session refreshed.",
        data: tokenPayload(tokens),
    });
});
export const logout = asyncHandler(async (request, response) => {
    const refreshToken = readCookie(request.headers.cookie, getCookieNames().refresh) ?? bodyRefreshToken(request);
    const sessionId = request.auth?.sessionId;
    await revokeSession(sessionId);
    if (refreshToken)
        await revokeByRefreshToken(refreshToken);
    clearTokenCookies(response);
    response.status(200).json({ success: true, message: "Signed out." });
});
export const forgotPassword = asyncHandler(async (request, response) => {
    await sendPasswordReset(request.body.email);
    response.status(200).json({ success: true, message: "If an account exists, password reset instructions will be sent." });
});
export const resetPassword = asyncHandler(async (request, response) => {
    await updatePassword(request.body);
    clearTokenCookies(response);
    response.status(200).json({ success: true, message: "Password reset. Please sign in again." });
});
export const handoff = asyncHandler(async (request, response) => {
    if (!request.auth?.sessionId)
        throw new ApiError(401, "Authentication is required.");
    const result = await createHandoffCode(request.auth.userId, request.auth.sessionId);
    response.status(200).json({ success: true, message: "Sign-in hand-off created.", data: result });
});
export const exchangeHandoff = asyncHandler(async (request, response) => {
    const result = await exchangeHandoffCode(request.body.code, requestContext(request));
    setTokenCookies(response, result.tokens);
    response.status(200).json({
        success: true,
        message: "Signed in.",
        data: { account: result.account, ...tokenPayload(result.tokens) },
    });
});
export const me = asyncHandler(async (request, response) => {
    if (!request.auth)
        throw new ApiError(401, "Authentication is required.");
    const account = await getMe(request.auth.userId);
    response.status(200).json({ success: true, message: "Account retrieved.", data: account });
});
export const updateMe = asyncHandler(async (request, response) => {
    if (!request.auth)
        throw new ApiError(401, "Authentication is required.");
    const account = await updateAccountProfile(request.auth.userId, request.body);
    response.status(200).json({ success: true, message: "Account profile updated.", data: account });
});
export { assertSafeOrigin };
//# sourceMappingURL=auth.controller.js.map
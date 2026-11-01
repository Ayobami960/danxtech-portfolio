import type { RequestHandler } from "express";
import { REFRESH_COOKIE, TWO_FACTOR_COOKIE } from "../config/constants.js";
import { asyncHandler } from "../lib/async-handler.js";
import {
  clearAuthCookies,
  clearCsrfCookie,
  clearSessionHintCookie,
  clearTwoFactorCookie,
  readCookie,
  setAuthCookies,
  setCsrfCookie,
  setSessionHintCookie,
  setTwoFactorCookie,
} from "../lib/cookies.js";
import { createCsrfToken } from "../lib/csrf.js";
import { body as readBody, currentAdmin } from "../lib/request.js";
import type {
  ChangePasswordInput,
  LoginInput,
  TwoFactorVerifyInput,
} from "../schemas/auth.schemas.js";
import { toSafeAdmin } from "../services/admin.service.js";
import * as authService from "../services/auth.service.js";

/** Issue a signed double-submit CSRF token as a readable cookie and JSON. */
export const getCsrf: RequestHandler = (_request, response) => {
  const csrfToken = createCsrfToken();
  setCsrfCookie(response, csrfToken);
  response.status(200).json({ csrfToken });
};

export const login = asyncHandler(async (request, response) => {
  const input = readBody<LoginInput>(request);
  const result = await authService.login(request, input.email, input.password);

  const csrfToken = createCsrfToken();
  setCsrfCookie(response, csrfToken);

  if (result.requires2fa) {
    // Half-authenticated: no session hint and no tokens until the code passes.
    clearSessionHintCookie(response);
    setTwoFactorCookie(response, result.challengeToken);
    response.status(200).json({ requires2fa: true, csrfToken });
    return;
  }

  setAuthCookies(response, result.accessToken, result.refreshToken);
  setSessionHintCookie(response);
  response.status(200).json({ admin: result.admin, csrfToken });
});

export const verifyTwoFactor = asyncHandler(async (request, response) => {
  const input = readBody<TwoFactorVerifyInput>(request);
  const result = await authService.completeTwoFactorLogin(
    request,
    readCookie(request, TWO_FACTOR_COOKIE),
    input.code,
  );

  clearTwoFactorCookie(response);
  setAuthCookies(response, result.accessToken, result.refreshToken);
  // Only now is this a real session.
  setSessionHintCookie(response);
  const csrfToken = createCsrfToken();
  setCsrfCookie(response, csrfToken);
  response.status(200).json({ admin: result.admin, csrfToken });
});

/**
 * POST /auth/2fa/cancel — abandon a pending challenge. Always 204, even with
 * nothing pending, and never touches an authenticated session.
 */
export const cancelTwoFactorLogin = asyncHandler(async (request, response) => {
  await authService.cancelTwoFactor(readCookie(request, TWO_FACTOR_COOKIE));
  clearTwoFactorCookie(response);
  response.status(204).end();
});

export const refresh = asyncHandler(async (request, response) => {
  const token = readCookie(request, REFRESH_COOKIE);
  try {
    const result = await authService.rotateRefreshToken(request, token);
    setAuthCookies(response, result.accessToken, result.refreshToken);
    response.status(200).json({ admin: result.admin });
  } catch (error) {
    // A dead session must not keep a stale cookie alive on the client.
    clearAuthCookies(response);
    clearSessionHintCookie(response);
    throw error;
  }
});

export const logout = asyncHandler(async (request, response) => {
  // A pending challenge dies with the session too.
  await authService.cancelTwoFactor(readCookie(request, TWO_FACTOR_COOKIE));
  await authService.logout(request, readCookie(request, REFRESH_COOKIE));
  clearAuthCookies(response);
  clearTwoFactorCookie(response);
  clearCsrfCookie(response);
  clearSessionHintCookie(response);
  response.status(204).end();
});

export const me: RequestHandler = (request, response) => {
  response.status(200).json({ admin: toSafeAdmin(currentAdmin(request)) });
};

export const changePassword = asyncHandler(async (request, response) => {
  const input = readBody<ChangePasswordInput>(request);
  await authService.changePassword(
    request,
    currentAdmin(request),
    input.currentPassword,
    input.newPassword,
  );

  // Every session was revoked; the caller has to sign in again.
  clearAuthCookies(response);
  clearCsrfCookie(response);
  clearTwoFactorCookie(response);
  clearSessionHintCookie(response);
  response.status(200).json({ ok: true, sessionsRevoked: true });
});

import type { CookieOptions, Request, Response } from "express";
import { env } from "../config/env.js";
import {
  ACCESS_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  CHAT_SESSION_COOKIE,
  CSRF_COOKIE,
  CSRF_TOKEN_TTL_SECONDS,
  GUEST_TOKEN_TTL_SECONDS,
  REFRESH_COOKIE,
  REFRESH_TOKEN_TTL_SECONDS,
  SESSION_HINT_COOKIE,
  TWO_FACTOR_CHALLENGE_TTL_SECONDS,
  TWO_FACTOR_COOKIE,
} from "../config/constants.js";

/** Read a string cookie without trusting the parser's `any` typing. */
export const readCookie = (
  request: Request,
  name: string,
): string | undefined => {
  const cookies = request.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const baseCookie = (): CookieOptions => ({
  secure: env.isProduction,
  sameSite: env.cookieSameSite,
  domain: env.cookieDomain,
  path: "/",
});

export const setAuthCookies = (
  response: Response,
  accessToken: string,
  refreshToken: string,
): void => {
  response.cookie(ACCESS_COOKIE, accessToken, {
    ...baseCookie(),
    httpOnly: true,
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  response.cookie(REFRESH_COOKIE, refreshToken, {
    ...baseCookie(),
    httpOnly: true,
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
};

export const clearAuthCookies = (response: Response): void => {
  response.clearCookie(ACCESS_COOKIE, { ...baseCookie(), httpOnly: true });
  response.clearCookie(REFRESH_COOKIE, { ...baseCookie(), httpOnly: true });
};

/**
 * `has_session` is readable by JavaScript on purpose: it carries no authority
 * and only tells the SPA that a real session exists. Set it on full login only
 * (never for a pending 2FA challenge) and clear it whenever the session dies.
 */
export const setSessionHintCookie = (response: Response): void => {
  response.cookie(SESSION_HINT_COOKIE, "1", {
    ...baseCookie(),
    httpOnly: false,
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
};

export const clearSessionHintCookie = (response: Response): void => {
  response.clearCookie(SESSION_HINT_COOKIE, {
    ...baseCookie(),
    httpOnly: false,
  });
};

export const setTwoFactorCookie = (
  response: Response,
  token: string,
): void => {
  response.cookie(TWO_FACTOR_COOKIE, token, {
    ...baseCookie(),
    httpOnly: true,
    maxAge: TWO_FACTOR_CHALLENGE_TTL_SECONDS * 1000,
  });
};

export const clearTwoFactorCookie = (response: Response): void => {
  response.clearCookie(TWO_FACTOR_COOKIE, { ...baseCookie(), httpOnly: true });
};

/**
 * Visitor chat session. httpOnly so page scripts cannot read it; the SPA also
 * receives the token in the response body because a client deployed on another
 * registrable domain cannot send a SameSite=Lax cookie cross-site.
 */
export const setChatSessionCookie = (
  response: Response,
  token: string,
): void => {
  response.cookie(CHAT_SESSION_COOKIE, token, {
    ...baseCookie(),
    httpOnly: true,
    maxAge: GUEST_TOKEN_TTL_SECONDS * 1000,
  });
};

export const clearChatSessionCookie = (response: Response): void => {
  response.clearCookie(CHAT_SESSION_COOKIE, {
    ...baseCookie(),
    httpOnly: true,
  });
};

export const setCsrfCookie = (response: Response, token: string): void => {
  response.cookie(CSRF_COOKIE, token, {
    ...baseCookie(),
    httpOnly: false,
    maxAge: CSRF_TOKEN_TTL_SECONDS * 1000,
  });
};

export const clearCsrfCookie = (response: Response): void => {
  response.clearCookie(CSRF_COOKIE, { ...baseCookie(), httpOnly: false });
};

export const getCookieOptions = baseCookie;

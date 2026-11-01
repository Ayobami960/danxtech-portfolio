import { SignJWT, jwtVerify, errors as joseErrors } from "jose";
import { env } from "../config/env.js";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  GUEST_TOKEN_TTL_SECONDS,
  TWO_FACTOR_CHALLENGE_TTL_SECONDS,
} from "../config/constants.js";
import { AppError, ERROR_CODES, unauthorized } from "./errors.js";

const accessKey = new TextEncoder().encode(env.jwtAccessSecret);

export type AccessTokenPayload = {
  sub: string;
  email: string;
};

export const signAccessToken = async (
  payload: AccessTokenPayload,
): Promise<string> =>
  new SignJWT({ email: payload.email, type: "access" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(accessKey);

/* --------------------------- 2FA login challenge --------------------------- */

/**
 * The cookie is only a signed pointer to a server-side challenge row (`jti`),
 * so the challenge can be revoked on demand — cancel, logout, a new password
 * login or too many bad codes — instead of merely ageing out.
 */
export type TwoFactorChallengePayload = {
  adminId: string;
  challengeId: string;
};

export const signTwoFactorChallenge = async (
  adminId: string,
  challengeId: string,
): Promise<string> =>
  new SignJWT({ type: "2fa" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(adminId)
    .setJti(challengeId)
    .setAudience("admin-2fa")
    .setIssuedAt()
    .setExpirationTime(`${TWO_FACTOR_CHALLENGE_TTL_SECONDS}s`)
    .sign(accessKey);

export const verifyTwoFactorChallenge = async (
  token: string,
): Promise<TwoFactorChallengePayload> => {
  try {
    const { payload } = await jwtVerify(token, accessKey, {
      algorithms: ["HS256"],
      audience: "admin-2fa",
    });
    if (
      payload.type !== "2fa" ||
      typeof payload.sub !== "string" ||
      typeof payload.jti !== "string"
    ) {
      throw new Error("Unexpected challenge payload.");
    }
    return { adminId: payload.sub, challengeId: payload.jti };
  } catch {
    // Distinct from "invalid code": the client returns to the password step
    // instead of suggesting the code was wrong.
    throw new AppError(
      401,
      ERROR_CODES.TWO_FACTOR_CHALLENGE_INVALID,
      "This sign-in challenge has expired. Sign in again.",
    );
  }
};

/* ------------------------------- guest chat ------------------------------- */

const guestKey = accessKey;

export const signGuestToken = async (
  conversationId: string,
): Promise<string> =>
  new SignJWT({ type: "guest", role: "guest" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(conversationId)
    .setAudience("chat-guest")
    .setIssuedAt()
    .setExpirationTime(`${GUEST_TOKEN_TTL_SECONDS}s`)
    .sign(guestKey);

export const verifyGuestToken = async (
  token: string,
): Promise<{ conversationId: string }> => {
  try {
    const { payload } = await jwtVerify(token, guestKey, {
      algorithms: ["HS256"],
      audience: "chat-guest",
    });
    if (
      payload.type !== "guest" ||
      payload.role !== "guest" ||
      typeof payload.sub !== "string"
    ) {
      throw new Error("Unexpected guest token payload.");
    }
    return { conversationId: payload.sub };
  } catch {
    throw unauthorized("This chat session is invalid or has expired.");
  }
};

export const verifyAccessToken = async (
  token: string,
): Promise<AccessTokenPayload> => {
  try {
    const { payload } = await jwtVerify(token, accessKey, {
      algorithms: ["HS256"],
    });
    if (
      payload.type !== "access" ||
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string"
    ) {
      throw new Error("Unexpected access token payload.");
    }
    return { sub: payload.sub, email: payload.email };
  } catch (error) {
    if (error instanceof joseErrors.JOSEError) {
      throw unauthorized("Session expired or invalid.");
    }
    throw error;
  }
};

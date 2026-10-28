import type { Request } from "express";
import { randomUUID } from "node:crypto";
import { AppError, ERROR_CODES, unauthorized } from "../lib/errors.js";
import {
  hashRefreshToken,
  hashIp,
  randomToken,
} from "../lib/crypto.js";
import {
  signAccessToken,
  signTwoFactorChallenge,
  verifyTwoFactorChallenge,
} from "../lib/jwt.js";
import {
  REFRESH_TOKEN_TTL_SECONDS,
  REFRESH_FAMILY_REVOKE_REASON,
} from "../config/constants.js";
import type { AdminUser } from "../database/schema.js";
import {
  findAdminByEmail,
  findAdminById,
  recordFailedLogin,
  recordSuccessfulLogin,
  updateAdminPassword,
} from "../repositories/admin.repository.js";
import {
  createRefreshToken,
  findRefreshTokenByHash,
  revokeAllRefreshTokensForUser,
  revokeRefreshFamily,
  revokeRefreshToken,
} from "../repositories/refresh-token.repository.js";
import { audit } from "../repositories/audit-writer.js";
import {
  hashPassword,
  toSafeAdmin,
  verifyPassword,
  type SafeAdmin,
} from "./admin.service.js";
import { checkSecondFactor } from "./account.service.js";
import { sendSecurityNotice } from "./mailer.js";
import { passwordPolicy } from "../lib/password-policy.js";

const INVALID_CREDENTIALS = "Invalid email or password.";
const LOCKED_MESSAGE =
  "Too many failed attempts. Please try again in 15 minutes.";
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

/**
 * A verified dummy hash keeps the "unknown email" path roughly as expensive as
 * the "wrong password" path, so response timing does not reveal accounts.
 */
const dummyHash = hashPassword(randomToken(16));

export type AuthResult = {
  admin: SafeAdmin;
  accessToken: string;
  refreshToken: string;
};

export type LoginResult =
  | ({ requires2fa: true; challengeToken: string })
  | (AuthResult & { requires2fa: false });

const issueSession = async (
  request: Request,
  admin: AdminUser,
): Promise<AuthResult> => {
  const refreshToken = randomToken(48);
  const familyId = randomUUID();
  const tokenHash = hashRefreshToken(refreshToken);

  await createRefreshToken({
    userId: admin.id,
    familyId,
    tokenHash,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    userAgent: request.get("user-agent")?.slice(0, 1000) ?? null,
    ipHash: hashIp(request.ip),
  });

  return {
    admin: toSafeAdmin(admin),
    accessToken: await signAccessToken({ sub: admin.id, email: admin.email }),
    refreshToken,
  };
};

export const login = async (
  request: Request,
  email: string,
  password: string,
): Promise<LoginResult> => {
  const normalizedEmail = email.trim().toLowerCase();
  const admin = await findAdminByEmail(normalizedEmail);

  if (!admin) {
    await verifyPassword(await dummyHash, password);
    await audit(request, {
      action: "auth.login.failure",
      entity: "admin",
      meta: { reason: "unknown_email" },
    });
    throw unauthorized(INVALID_CREDENTIALS);
  }

  if (admin.lockedUntil && admin.lockedUntil.getTime() > Date.now()) {
    await audit(request, {
      action: "auth.login.failure",
      entity: "admin",
      entityId: admin.id,
      userId: admin.id,
      meta: { reason: "locked" },
    });
    throw new AppError(429, ERROR_CODES.RATE_LIMITED, LOCKED_MESSAGE);
  }

  const passwordMatches = await verifyPassword(admin.passwordHash, password);
  if (!passwordMatches) {
    const attempts = admin.failedAttempts + 1;
    const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
    // Keep the attempt count while locked so the next failure after the lock
    // window expires locks the account again immediately.
    await recordFailedLogin(
      admin.id,
      attempts,
      shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : null,
    );
    await audit(request, {
      action: "auth.login.failure",
      entity: "admin",
      entityId: admin.id,
      userId: admin.id,
      meta: { reason: "wrong_password", attempts },
    });
    if (shouldLock) {
      void sendSecurityNotice("Admin account locked", [
        "Your portfolio admin account was locked for 15 minutes after 5 failed sign-in attempts.",
        `Approximate time: ${new Date().toISOString()}`,
      ]);
    }
    throw unauthorized(INVALID_CREDENTIALS);
  }

  if (admin.totpEnabled) {
    await audit(request, {
      action: "auth.login.2fa_required",
      entity: "admin",
      entityId: admin.id,
      userId: admin.id,
    });
    return {
      requires2fa: true,
      challengeToken: await signTwoFactorChallenge(admin.id),
    };
  }

  await recordSuccessfulLogin(admin.id);
  const result = await issueSession(request, admin);
  await audit(request, {
    action: "auth.login.success",
    entity: "admin",
    entityId: admin.id,
    userId: admin.id,
  });
  return { ...result, requires2fa: false };
};

/** Complete a password-verified login with a TOTP or recovery code. */
export const completeTwoFactorLogin = async (
  request: Request,
  challengeToken: string | undefined,
  code: string,
): Promise<AuthResult> => {
  if (!challengeToken) {
    throw unauthorized("Your sign-in challenge expired. Please sign in again.");
  }

  const adminId = await verifyTwoFactorChallenge(challengeToken);
  const admin = await findAdminById(adminId);
  if (!admin) throw unauthorized(INVALID_CREDENTIALS);

  if (admin.lockedUntil && admin.lockedUntil.getTime() > Date.now()) {
    throw new AppError(429, ERROR_CODES.RATE_LIMITED, LOCKED_MESSAGE);
  }

  try {
    await checkSecondFactor(request, admin, code);
  } catch (error) {
    const attempts = admin.failedAttempts + 1;
    const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
    await recordFailedLogin(
      admin.id,
      attempts,
      shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : null,
    );
    await audit(request, {
      action: "auth.login.failure",
      entity: "admin",
      entityId: admin.id,
      userId: admin.id,
      meta: { reason: "invalid_2fa", attempts },
    });
    if (shouldLock) {
      void sendSecurityNotice("Admin account locked", [
        "Your portfolio admin account was locked for 15 minutes after 5 failed verification attempts.",
      ]);
    }
    throw error;
  }

  await recordSuccessfulLogin(admin.id);
  const result = await issueSession(request, admin);
  await audit(request, {
    action: "auth.login.success",
    entity: "admin",
    entityId: admin.id,
    userId: admin.id,
    meta: { secondFactor: true },
  });
  return result;
};

const revokeFamilyForReuse = async (
  request: Request,
  familyId: string,
  userId: string,
): Promise<never> => {
  await revokeRefreshFamily(familyId);
  await audit(request, {
    action: "auth.refresh.reuse",
    entity: "refresh_token",
    entityId: familyId,
    userId,
    meta: { reason: REFRESH_FAMILY_REVOKE_REASON },
  });
  throw unauthorized("Session expired or invalid.");
};

export const rotateRefreshToken = async (
  request: Request,
  rawToken: string | undefined,
): Promise<AuthResult> => {
  if (!rawToken) {
    throw unauthorized("Session expired or invalid.");
  }

  const row = await findRefreshTokenByHash(hashRefreshToken(rawToken));
  if (!row) {
    throw unauthorized("Session expired or invalid.");
  }

  if (row.revokedAt) {
    // A rotated token was replayed. Kill every descendant of this login.
    return revokeFamilyForReuse(request, row.familyId, row.userId);
  }

  if (row.expiresAt.getTime() <= Date.now()) {
    await revokeRefreshToken(row.id, null);
    throw unauthorized("Session expired or invalid.");
  }

  const admin = await findAdminById(row.userId);
  if (!admin) {
    await revokeRefreshFamily(row.familyId);
    throw unauthorized("Session expired or invalid.");
  }

  const newToken = randomToken(48);
  const replacement = await createRefreshToken({
    userId: admin.id,
    familyId: row.familyId,
    tokenHash: hashRefreshToken(newToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    userAgent: request.get("user-agent")?.slice(0, 1000) ?? null,
    ipHash: hashIp(request.ip),
  });
  await revokeRefreshToken(row.id, replacement.id);

  await audit(request, {
    action: "auth.refresh",
    entity: "refresh_token",
    entityId: replacement.id,
    userId: admin.id,
  });

  return {
    admin: toSafeAdmin(admin),
    accessToken: await signAccessToken({ sub: admin.id, email: admin.email }),
    refreshToken: newToken,
  };
};

export const logout = async (
  request: Request,
  rawToken: string | undefined,
): Promise<void> => {
  if (rawToken) {
    const row = await findRefreshTokenByHash(hashRefreshToken(rawToken));
    if (row && !row.revokedAt) {
      await revokeRefreshToken(row.id, null);
      await audit(request, {
        action: "auth.logout",
        entity: "refresh_token",
        entityId: row.id,
        userId: row.userId,
      });
    }
  }
};

export const changePassword = async (
  request: Request,
  admin: AdminUser,
  currentPassword: string,
  newPassword: string,
): Promise<void> => {
  const matches = await verifyPassword(admin.passwordHash, currentPassword);
  if (!matches) {
    await audit(request, {
      action: "auth.password.change_failure",
      entity: "admin",
      entityId: admin.id,
      userId: admin.id,
    });
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      "Current password is incorrect.",
    );
  }

  const policy = passwordPolicy(newPassword, admin.email);
  if (!policy.ok) {
    throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, policy.message);
  }

  await updateAdminPassword(admin.id, await hashPassword(newPassword));
  await revokeAllRefreshTokensForUser(admin.id);
  await audit(request, {
    action: "auth.password.change",
    entity: "admin",
    entityId: admin.id,
    userId: admin.id,
  });
  void sendSecurityNotice("Admin password changed", [
    "Your portfolio admin password was changed and every session was signed out.",
  ]);
};

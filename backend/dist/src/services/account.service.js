import { randomBytes } from "node:crypto";
import { AppError, ERROR_CODES, notFound } from "../lib/errors.js";
import { hashRefreshToken, sha256Hex } from "../lib/crypto.js";
import { readCookie } from "../lib/cookies.js";
import { RECOVERY_CODE_COUNT, REFRESH_COOKIE } from "../config/constants.js";
import { findRefreshTokenByHash } from "../repositories/refresh-token.repository.js";
import { countUnusedRecoveryCodes, findUnusedRecoveryCode, listActiveSessions, markRecoveryCodeUsed, replaceRecoveryCodes, revokeOtherFamilies, revokeSessionFamily, setTotpSecret, } from "../repositories/account.repository.js";
import { updateAdminPassword } from "../repositories/admin.repository.js";
import { audit } from "../repositories/audit-writer.js";
import { buildOtpAuthUrl, createTotpSecret, decryptSecret, encryptSecret, verifyTotp, } from "../lib/totp.js";
import { passwordPolicy } from "../lib/password-policy.js";
import { hashPassword, verifyPassword } from "./admin.service.js";
import { sendSecurityNotice } from "./mailer.js";
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const generateRecoveryCode = () => {
    const bytes = randomBytes(10);
    const chars = Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]);
    return `${chars.slice(0, 5).join("")}-${chars.slice(5).join("")}`;
};
const normalizeRecoveryCode = (code) => code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
const hashCode = (code) => sha256Hex(normalizeRecoveryCode(code));
const generateRecoveryCodes = async (userId) => {
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
    await replaceRecoveryCodes(userId, codes.map(hashCode));
    return codes;
};
export const currentRefreshFamily = async (request, userId) => {
    const raw = readCookie(request, REFRESH_COOKIE);
    if (!raw)
        return null;
    const row = await findRefreshTokenByHash(hashRefreshToken(raw));
    return row && row.userId === userId ? row.familyId : null;
};
/* --------------------------------- 2FA setup -------------------------------- */
export const twoFactorStatus = async (admin) => ({
    enabled: admin.totpEnabled,
    configured: Boolean(admin.totpSecretEnc),
    recoveryCodesRemaining: admin.totpEnabled
        ? await countUnusedRecoveryCodes(admin.id)
        : 0,
});
export const beginTwoFactorSetup = async (request, admin) => {
    if (admin.totpEnabled) {
        throw new AppError(409, ERROR_CODES.CONFLICT, "Two-factor authentication is already enabled.");
    }
    const secret = createTotpSecret();
    await setTotpSecret(admin.id, encryptSecret(secret), false);
    await audit(request, {
        action: "account.2fa.setup",
        entity: "admin",
        entityId: admin.id,
        userId: admin.id,
    });
    return { otpauthUrl: buildOtpAuthUrl(secret, admin.email), secret };
};
export const enableTwoFactor = async (request, admin, code) => {
    if (admin.totpEnabled) {
        throw new AppError(409, ERROR_CODES.CONFLICT, "Two-factor authentication is already enabled.");
    }
    if (!admin.totpSecretEnc) {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, "Start the two-factor setup before enabling it.");
    }
    const secret = decryptSecret(admin.totpSecretEnc);
    if (!verifyTotp(secret, admin.email, code)) {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, "Invalid code.");
    }
    await setTotpSecret(admin.id, admin.totpSecretEnc, true);
    const recoveryCodes = await generateRecoveryCodes(admin.id);
    await audit(request, {
        action: "account.2fa.enable",
        entity: "admin",
        entityId: admin.id,
        userId: admin.id,
    });
    void sendSecurityNotice("Two-factor authentication enabled", [
        "2FA was enabled for your portfolio admin account.",
        `If this was not you, change your password immediately.`,
    ]);
    return { recoveryCodes };
};
export const disableTwoFactor = async (request, admin, password, code) => {
    if (!(await verifyPassword(admin.passwordHash, password))) {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, "Current password is incorrect.");
    }
    if (!admin.totpEnabled || !admin.totpSecretEnc) {
        throw new AppError(409, ERROR_CODES.CONFLICT, "Two-factor authentication is not enabled.");
    }
    const secret = decryptSecret(admin.totpSecretEnc);
    const validTotp = verifyTotp(secret, admin.email, code);
    const recovery = validTotp ? null : await findUnusedRecoveryCode(admin.id, hashCode(code));
    if (!validTotp && !recovery) {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, "Invalid code.");
    }
    if (recovery)
        await markRecoveryCodeUsed(recovery.id);
    await setTotpSecret(admin.id, null, false);
    await replaceRecoveryCodes(admin.id, []);
    await audit(request, {
        action: "account.2fa.disable",
        entity: "admin",
        entityId: admin.id,
        userId: admin.id,
    });
    void sendSecurityNotice("Two-factor authentication disabled", [
        "2FA was disabled for your portfolio admin account.",
        "If this was not you, change your password immediately.",
    ]);
};
export const regenerateRecoveryCodes = async (request, admin, password) => {
    if (!(await verifyPassword(admin.passwordHash, password))) {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, "Current password is incorrect.");
    }
    if (!admin.totpEnabled) {
        throw new AppError(409, ERROR_CODES.CONFLICT, "Two-factor authentication is not enabled.");
    }
    const recoveryCodes = await generateRecoveryCodes(admin.id);
    await audit(request, {
        action: "account.2fa.recovery_codes",
        entity: "admin",
        entityId: admin.id,
        userId: admin.id,
    });
    return { recoveryCodes };
};
/** Used by the login flow to check a code without revealing which kind it was. */
export const checkSecondFactor = async (request, admin, code) => {
    if (!admin.totpEnabled || !admin.totpSecretEnc) {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, "Two-factor authentication is not enabled.");
    }
    const secret = decryptSecret(admin.totpSecretEnc);
    if (verifyTotp(secret, admin.email, code))
        return "totp";
    const recovery = await findUnusedRecoveryCode(admin.id, hashCode(code));
    if (!recovery) {
        throw new AppError(401, ERROR_CODES.UNAUTHORIZED, "Invalid code.");
    }
    await markRecoveryCodeUsed(recovery.id);
    await audit(request, {
        action: "account.recovery_code.used",
        entity: "admin",
        entityId: admin.id,
        userId: admin.id,
    });
    void sendSecurityNotice("Recovery code used", [
        "A one-time recovery code was used to sign in to your portfolio admin.",
        "Regenerate your recovery codes from the Account page if this was not you.",
    ]);
    return "recovery";
};
const describeDevice = (userAgent) => {
    if (!userAgent)
        return "Unknown device";
    const browser = /Edg\//.test(userAgent)
        ? "Edge"
        : /OPR\//.test(userAgent)
            ? "Opera"
            : /Firefox\//.test(userAgent)
                ? "Firefox"
                : /Chrome\//.test(userAgent)
                    ? "Chrome"
                    : /Safari\//.test(userAgent)
                        ? "Safari"
                        : "Browser";
    const os = /Windows/.test(userAgent)
        ? "Windows"
        : /Mac OS X/.test(userAgent)
            ? "macOS"
            : /Android/.test(userAgent)
                ? "Android"
                : /iPhone|iPad/.test(userAgent)
                    ? "iOS"
                    : /Linux/.test(userAgent)
                        ? "Linux"
                        : "Unknown OS";
    return `${browser} · ${os}`;
};
export const sessions = async (request, admin) => {
    const currentFamily = await currentRefreshFamily(request, admin.id);
    const rows = await listActiveSessions(admin.id);
    return rows.map((row) => ({
        id: row.familyId,
        device: describeDevice(row.userAgent),
        createdAt: row.createdAt,
        lastUsedAt: row.lastUsedAt,
        expiresAt: row.expiresAt,
        current: row.familyId === currentFamily,
    }));
};
export const revokeSession = async (request, admin, familyId) => {
    const currentFamily = await currentRefreshFamily(request, admin.id);
    if (familyId === currentFamily) {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, "Use “Sign out” to end this session.");
    }
    const revoked = await revokeSessionFamily(admin.id, familyId);
    if (!revoked)
        throw notFound("Session not found.");
    await audit(request, {
        action: "account.session.revoke",
        entity: "session",
        entityId: familyId,
        userId: admin.id,
    });
};
export const revokeOtherSessions = async (request, admin) => {
    const currentFamily = await currentRefreshFamily(request, admin.id);
    const count = await revokeOtherFamilies(admin.id, currentFamily);
    await audit(request, {
        action: "account.session.revoke_others",
        entity: "session",
        userId: admin.id,
        meta: { revoked: count },
    });
    return count;
};
/* -------------------------------- password -------------------------------- */
export const updatePassword = async (request, admin, currentPassword, newPassword) => {
    if (!(await verifyPassword(admin.passwordHash, currentPassword))) {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, "Current password is incorrect.");
    }
    const policy = passwordPolicy(newPassword, admin.email);
    if (!policy.ok) {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, policy.message);
    }
    await updateAdminPassword(admin.id, await hashPassword(newPassword));
    await revokeOtherFamilies(admin.id, null);
    await audit(request, {
        action: "account.password.change",
        entity: "admin",
        entityId: admin.id,
        userId: admin.id,
    });
    void sendSecurityNotice("Admin password changed", [
        "Your portfolio admin password was changed.",
        "Every existing session was signed out.",
        "If this was not you, reset access immediately.",
    ]);
};
//# sourceMappingURL=account.service.js.map
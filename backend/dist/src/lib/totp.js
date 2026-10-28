import { createCipheriv, createDecipheriv, randomBytes, } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import { env } from "../config/env.js";
import { AppError, ERROR_CODES } from "./errors.js";
const ISSUER = "Adetoye Daniel";
const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
/** Accept a base64 or 64-character hex 32-byte key. */
const encryptionKey = () => {
    const raw = env.totpEncryptionKey;
    if (!raw) {
        throw new AppError(503, ERROR_CODES.SERVICE_UNAVAILABLE, "Two-factor authentication is not configured on this server.");
    }
    const key = /^[0-9a-fA-F]{64}$/.test(raw)
        ? Buffer.from(raw, "hex")
        : Buffer.from(raw, "base64");
    if (key.length !== 32) {
        throw new AppError(500, ERROR_CODES.INTERNAL_ERROR, "TOTP_ENCRYPTION_KEY must decode to exactly 32 bytes.");
    }
    return key;
};
export const isTwoFactorConfigured = () => Boolean(env.totpEncryptionKey);
export const encryptSecret = (plain) => {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
        VERSION,
        iv.toString("base64"),
        tag.toString("base64"),
        encrypted.toString("base64"),
    ].join(":");
};
export const decryptSecret = (payload) => {
    const [version, ivB64, tagB64, dataB64] = payload.split(":");
    if (version !== VERSION || !ivB64 || !tagB64 || !dataB64) {
        throw new Error("Unsupported encrypted secret format.");
    }
    const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
        decipher.update(Buffer.from(dataB64, "base64")),
        decipher.final(),
    ]).toString("utf8");
};
export const createTotpSecret = () => new Secret().base32;
export const totpFor = (secret, email) => new TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret),
});
export const buildOtpAuthUrl = (secret, email) => totpFor(secret, email).toString();
/** Validate a 6-digit code with a ±1 step window. */
export const verifyTotp = (secret, email, token) => {
    const normalized = token.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(normalized))
        return false;
    const delta = totpFor(secret, email).validate({
        token: normalized,
        window: 1,
    });
    return delta !== null;
};
//# sourceMappingURL=totp.js.map
import { createHash, randomBytes, randomUUID, timingSafeEqual, } from "node:crypto";
import { env } from "../config/env.js";
/** SHA-256 hex digest. */
export const sha256Hex = (value) => createHash("sha256").update(value).digest("hex");
/** Never persist a raw IP: `sha256(ip + IP_HASH_SALT)`. */
export const hashIp = (ip) => {
    if (!ip)
        return null;
    return sha256Hex(`${ip}:${env.ipHashSalt}`);
};
/** Opaque, URL-safe random token. */
export const randomToken = (bytes = 48) => randomBytes(bytes).toString("base64url");
export const newId = () => randomUUID();
/**
 * Refresh tokens are hashed together with the refresh secret before storage.
 * The resulting value is still a 64-character SHA-256 hex digest, so it fits
 * `refresh_tokens.token_hash`, but a leaked database dump cannot be replayed.
 */
export const hashRefreshToken = (token) => sha256Hex(`${token}:${env.jwtRefreshSecret}`);
export const constantTimeEqual = (a, b) => {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    if (left.length !== right.length)
        return false;
    return timingSafeEqual(left, right);
};
const normalizeWhitespace = (value) => value.trim().replace(/\s+/g, " ");
/** Duplicate-detection digest for contact submissions. */
export const contactMessageHash = (email, message) => sha256Hex(`${email.trim().toLowerCase()}\u0000${normalizeWhitespace(message)}`);
//# sourceMappingURL=crypto.js.map
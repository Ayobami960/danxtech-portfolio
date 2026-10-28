import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

/** Six digits, ten minutes, five attempts, one minute between sends. */
export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_WINDOW_MS = 60 * 60 * 1000;
export const OTP_MAX_CODES_PER_HOUR = 5;

export const generateOtpCode = (): string =>
  String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");

/**
 * The code is only ever stored as an HMAC keyed with a server secret, so a
 * leaked table row cannot be brute-forced offline (a six-digit space is tiny).
 */
const digest = (
  code: string,
  conversationId: string,
  email: string,
): Buffer =>
  createHmac("sha256", env.csrfSecret)
    .update(`chat-otp:${conversationId}:${email.trim().toLowerCase()}:${code}`)
    .digest();

export const hashOtpCode = (
  code: string,
  conversationId: string,
  email: string,
): string => digest(code, conversationId, email).toString("hex");

/** Constant-time comparison of a submitted code against the stored hash. */
export const otpCodeMatches = (
  code: string,
  storedHash: string,
  conversationId: string,
  email: string,
): boolean => {
  const candidate = digest(code, conversationId, email);
  const stored = Buffer.from(storedHash, "hex");
  return stored.length === candidate.length && timingSafeEqual(candidate, stored);
};

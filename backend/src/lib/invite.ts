import { createHmac } from "node:crypto";
import { env } from "../config/env.js";
import { sha256Hex } from "./crypto.js";

/**
 * Invite tokens are derived from the conversation id and the moment the invite
 * was issued, keyed with the CSRF secret. That lets the server rebuild the link
 * later for reminder emails while the database keeps only the SHA-256 hash.
 *
 * The token is the entry credential only: it never opens the chat by itself.
 * The visitor still proves ownership of the email with an OTP.
 */
export const inviteTokenFor = (
  conversationId: string,
  sentAt: Date,
): string =>
  createHmac("sha256", env.csrfSecret)
    .update(`chat-invite:${conversationId}:${sentAt.toISOString()}`)
    .digest("base64url");

export const inviteHashFor = (token: string): string => sha256Hex(token);

/** `#c` carries the conversation id, `#t` the invite token — never sent to a server. */
export const chatLinkFor = (conversationId: string, token: string): string => {
  const base = env.clientOrigin ?? "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}/chat#c=${conversationId}&t=${token}`;
};

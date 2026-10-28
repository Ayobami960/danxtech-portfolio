import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError, ERROR_CODES } from "../lib/errors.js";
import { escapeHtml } from "../lib/html.js";
import { inviteHashFor } from "../lib/invite.js";
import { setChatSessionCookie } from "../lib/cookies.js";
import { signGuestToken } from "../lib/jwt.js";
import { OTP_MAX_ATTEMPTS, OTP_MAX_CODES_PER_HOUR, OTP_RESEND_COOLDOWN_MS, OTP_TTL_MS, OTP_WINDOW_MS, generateOtpCode, hashOtpCode, otpCodeMatches, } from "../lib/otp.js";
import { consumeCode, countCodesSince, createVerificationCode, findActiveCode, latestCodeCreatedAt, registerFailedAttempt, } from "../repositories/chat-verification.repository.js";
import { findConversationById, resetUnread, updateConversation, } from "../repositories/conversation.repository.js";
import { latestSeq, listMessages, markDelivered, } from "../repositories/chat.repository.js";
import { audit } from "../repositories/audit-writer.js";
import { emailShell, sendMail } from "./mailer.js";
import { OWNER_NAME, guestConversationView } from "./chat.service.js";
import { realtime, toMessageEvent } from "../realtime/bus.js";
/** Identical for a match and a mismatch: the endpoint must not enumerate emails. */
export const GENERIC_CODE_MESSAGE = "If this email is linked to this conversation, a code has been sent.";
const GENERIC_CODE_ERROR = "That code is not valid. Request a new one.";
const EXPIRED_CODE_ERROR = "That code has expired. Request a new one.";
const WRONG_CODE_ERROR = "That code is incorrect. Please try again.";
const LOCKED_CODE_ERROR = "Too many incorrect codes. Request a new one.";
const resolveInvite = async (conversationId, token) => {
    const conversation = await findConversationById(conversationId);
    if (!conversation ||
        !conversation.inviteTokenHash ||
        conversation.inviteTokenHash !== inviteHashFor(token)) {
        throw new AppError(404, ERROR_CODES.INVITE_INVALID, "This link is not valid.");
    }
    if (conversation.inviteRevokedAt) {
        throw new AppError(404, ERROR_CODES.INVITE_INVALID, "This link is not valid.");
    }
    if (!conversation.inviteExpiresAt ||
        conversation.inviteExpiresAt.getTime() <= Date.now()) {
        throw new AppError(404, ERROR_CODES.INVITE_INVALID, "This link is not valid.");
    }
    if (conversation.status === "closed" || conversation.status === "archived") {
        throw new AppError(410, ERROR_CODES.CHAT_CLOSED, "This conversation was closed.");
    }
    return conversation;
};
const otpEmail = (conversation, code, expiresAt) => {
    const firstName = conversation.visitorName.split(" ")[0] ?? "there";
    const expiry = expiresAt.toUTCString();
    const subject = `Your verification code: ${code}`;
    return {
        subject,
        text: [
            `Hi ${firstName},`,
            "",
            `Your verification code is ${code}.`,
            `It expires in 10 minutes (${expiry}).`,
            "",
            "Enter it on the chat page to continue your conversation.",
            "If you did not request this code, you can safely ignore this email.",
            "",
            `You received this email because you contacted ${OWNER_NAME} through his portfolio.`,
        ].join("\n"),
        html: emailShell("Your chat verification code", [
            `Hi ${escapeHtml(firstName)},`,
            `Use this code to open your private chat:`,
            `<span style="display:inline-block;margin:8px 0;padding:12px 20px;border-radius:10px;background:#0f172a;color:#ffffff;font-family:ui-monospace,monospace;font-size:26px;letter-spacing:8px">${escapeHtml(code)}</span>`,
            `The code expires in 10 minutes (${escapeHtml(expiry)}).`,
            `If you did not request it, you can safely ignore this email.`,
        ], undefined, `You received this email because you contacted ${OWNER_NAME} through his portfolio.`),
    };
};
/**
 * Step 1: send a one-time code to the conversation's email. A mismatched email,
 * a resend inside the cooldown and the per-hour cap all answer identically so
 * the endpoint cannot be used to discover which address owns a conversation.
 */
export const requestCode = async (request, input) => {
    const conversation = await resolveInvite(input.conversationId, input.token);
    const email = input.email.trim().toLowerCase();
    if (email !== conversation.visitorEmail.trim().toLowerCase()) {
        return { ok: true, message: GENERIC_CODE_MESSAGE };
    }
    const now = Date.now();
    const lastCreatedAt = await latestCodeCreatedAt(conversation.id);
    if (lastCreatedAt &&
        now - lastCreatedAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
        return { ok: true, message: GENERIC_CODE_MESSAGE };
    }
    const recent = await countCodesSince(conversation.id, new Date(now - OTP_WINDOW_MS));
    if (recent >= OTP_MAX_CODES_PER_HOUR) {
        logger.warn({ conversationId: conversation.id }, "Chat verification code request throttled");
        return { ok: true, message: GENERIC_CODE_MESSAGE };
    }
    const code = generateOtpCode();
    const expiresAt = new Date(now + OTP_TTL_MS);
    await createVerificationCode({
        conversationId: conversation.id,
        email,
        codeHash: hashOtpCode(code, conversation.id, email),
        expiresAt,
    });
    // A mail outage must not reveal anything or fail the request.
    try {
        await sendMail({
            to: email,
            replyTo: env.ownerEmail,
            ...otpEmail(conversation, code, expiresAt),
        });
    }
    catch (error) {
        logger.error({ err: error, conversationId: conversation.id }, "Chat verification email failed");
    }
    await audit(request, {
        action: "chat.otp.request",
        entity: "conversation",
        entityId: conversation.id,
    });
    return { ok: true, message: GENERIC_CODE_MESSAGE };
};
/**
 * Step 2: constant-time code check, single use, locked after five failures.
 * Success issues the visitor session (httpOnly cookie + body token for the SPA).
 */
export const confirmCode = async (request, response, input) => {
    const conversation = await resolveInvite(input.conversationId, input.token);
    const email = input.email.trim().toLowerCase();
    if (email !== conversation.visitorEmail.trim().toLowerCase()) {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, GENERIC_CODE_ERROR);
    }
    const record = await findActiveCode(conversation.id, email);
    if (!record) {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, GENERIC_CODE_ERROR);
    }
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
        throw new AppError(429, ERROR_CODES.RATE_LIMITED, LOCKED_CODE_ERROR);
    }
    if (record.expiresAt.getTime() <= Date.now()) {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, EXPIRED_CODE_ERROR);
    }
    if (!otpCodeMatches(input.code, record.codeHash, conversation.id, email)) {
        const attempts = await registerFailedAttempt(record.id);
        if (attempts >= OTP_MAX_ATTEMPTS) {
            throw new AppError(429, ERROR_CODES.RATE_LIMITED, LOCKED_CODE_ERROR);
        }
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, WRONG_CODE_ERROR);
    }
    const now = new Date();
    await consumeCode(record.id, now);
    const guestToken = await signGuestToken(conversation.id);
    setChatSessionCookie(response, guestToken);
    await updateConversation(conversation.id, {
        visitorVerifiedAt: conversation.visitorVerifiedAt ?? now,
        visitorLastSeenAt: now,
        ...(conversation.status === "new" ? { status: "open" } : {}),
    });
    await resetUnread(conversation.id, "visitor", now);
    await markDelivered(conversation.id, await latestSeq(conversation.id), "visitor");
    const history = await listMessages(conversation.id, { limit: 50 });
    await audit(request, {
        action: "chat.otp.verify",
        entity: "conversation",
        entityId: conversation.id,
    });
    realtime().toAdmins("conversation:update", {
        id: conversation.id,
        patch: { visitorVerifiedAt: now, status: "open" },
    });
    return {
        guestToken,
        conversation: guestConversationView(conversation),
        messages: history.map(toMessageEvent),
        developer: { name: OWNER_NAME },
    };
};
//# sourceMappingURL=chat-verification.service.js.map
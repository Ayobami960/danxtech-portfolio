import { randomUUID } from "node:crypto";
import { AppError, ERROR_CODES, conflict, notFound } from "../lib/errors.js";
import { escapeHtml } from "../lib/html.js";
import { sha256Hex } from "../lib/crypto.js";
import { chatLinkFor, inviteHashFor, inviteTokenFor } from "../lib/invite.js";
import { verifyGuestToken } from "../lib/jwt.js";
import { readCookie } from "../lib/cookies.js";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";
import { CHAT_OWNER_NAME, CHAT_SESSION_COOKIE, INVITE_TTL_DAYS, MAX_PAGE_SIZE, } from "../config/constants.js";
import { getStorage } from "../storage/index.js";
import { processImage } from "./image.service.js";
import { countRecentMessages, createConversation, deleteConversation, findConversationById, incrementUnread, listConversations, resetUnread, touchConversation, updateConversation, countUnreadConversations, countOpenConversations, countConversations, } from "../repositories/conversation.repository.js";
import { insertMessage, latestSeq, listMessages, markDelivered, markRead, } from "../repositories/chat.repository.js";
import { audit } from "../repositories/audit-writer.js";
import { emailShell, sendMail } from "./mailer.js";
import { realtime, toConversationEvent, toMessageEvent } from "../realtime/bus.js";
export const OWNER_NAME = CHAT_OWNER_NAME;
const EMAIL_THROTTLE_MS = 10 * 60 * 1000;
const GUEST_MESSAGES_PER_MINUTE = 20;
const GUEST_MESSAGES_PER_DAY = 300;
const ADMIN_MESSAGES_PER_MINUTE = 60;
const inviteStatus = (conversation) => {
    if (!conversation.inviteTokenHash)
        return "none";
    if (conversation.inviteRevokedAt)
        return "revoked";
    if (conversation.inviteExpiresAt &&
        conversation.inviteExpiresAt.getTime() <= Date.now()) {
        return "expired";
    }
    return "active";
};
export const conversationView = (conversation) => ({
    ...toConversationEvent(conversation),
    invite: {
        status: inviteStatus(conversation),
        expiresAt: conversation.inviteExpiresAt,
        sentAt: conversation.inviteSentAt,
    },
});
export const guestConversationView = (conversation) => ({
    id: conversation.id,
    subject: conversation.subject,
    status: conversation.status,
    lastMessageAt: conversation.lastMessageAt,
});
/** A visitor reaches a chat only through a conversation they may read. */
const assertGuestAccess = async (conversationId) => {
    const conversation = await findConversationById(conversationId);
    if (!conversation) {
        throw new AppError(404, ERROR_CODES.INVITE_INVALID, "This link is not valid.");
    }
    if (conversation.inviteRevokedAt) {
        throw new AppError(404, ERROR_CODES.INVITE_INVALID, "This link is not valid.");
    }
    if (conversation.status === "closed" || conversation.status === "archived") {
        throw new AppError(410, ERROR_CODES.CHAT_CLOSED, "This conversation was closed.");
    }
    return conversation;
};
const ADMIN_PATH = "/inbox";
const adminLink = (conversationId) => {
    if (!env.adminOrigin)
        return null;
    return `${env.adminOrigin.replace(/\/+$/, "")}${ADMIN_PATH}/${conversationId}`;
};
/** Deep link into the admin chat space, for notification emails. */
export const adminConversationLink = (conversationId) => adminLink(conversationId);
const previewText = (value) => value.length > 200 ? `${value.slice(0, 200)}…` : value;
/** Message list preview: text, or a label for an image-only message. */
const messagePreview = (body, hasImage) => body.length > 0 ? body : hasImage ? "Photo" : "";
/** An attachment must belong to the conversation it is posted to. */
const assertImageKey = (conversationId, imageKey) => {
    if (!imageKey)
        return null;
    if (!imageKey.startsWith(`chat/${conversationId}/`)) {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, "That image does not belong to this conversation.");
    }
    return imageKey;
};
/* ------------------------------ conversations ------------------------------ */
export const createConversationFromContact = async (input) => {
    try {
        const now = new Date();
        const conversation = await createConversation({
            contactMessageId: input.contactMessageId,
            visitorName: input.name,
            visitorEmail: input.email,
            subject: input.subject,
            status: "new",
            starred: false,
            isSpam: false,
            unreadForAdmin: 1,
            unreadForVisitor: 0,
            lastMessageAt: now,
            lastMessagePreview: input.message.slice(0, 160),
            visitorLastSeenAt: null,
            adminLastSeenAt: null,
            inviteTokenHash: null,
            inviteExpiresAt: null,
            inviteSentAt: null,
            inviteRevokedAt: null,
            visitorVerifiedAt: null,
            ownerEmailedAt: now,
            visitorEmailedAt: null,
            ipHash: input.ipHash,
            closedAt: null,
        });
        const { message } = await insertMessage({
            conversationId: conversation.id,
            sender: "visitor",
            body: input.message,
            clientMsgId: null,
        });
        realtime().toAdmins("conversation:new", {
            conversation: conversationView(conversation),
        });
        realtime().toAdmins("message:new", {
            message: toMessageEvent(message),
            conversation: conversationView(conversation),
        });
        return conversation;
    }
    catch (error) {
        // A chat failure must never cost the visitor their contact submission.
        logger.error({ err: error }, "Failed to create a chat conversation");
        return null;
    }
};
export const adminListConversations = async (query) => {
    const filters = {
        ...(query.status ? { status: query.status } : {}),
        ...(query.starred !== undefined ? { starred: query.starred } : {}),
        ...(query.isSpam !== undefined ? { isSpam: query.isSpam } : {}),
        ...(query.unread !== undefined ? { unread: query.unread } : {}),
        ...(query.q ? { q: query.q } : {}),
    };
    const { rows, total } = await listConversations(filters, query.page, Math.min(query.pageSize, MAX_PAGE_SIZE));
    return { rows: rows.map(conversationView), total };
};
export const adminGetConversation = async (id) => {
    const conversation = await findConversationById(id);
    if (!conversation)
        throw notFound("Conversation not found.");
    return conversationView(conversation);
};
export const adminMessagePage = async (id, options) => {
    const conversation = await findConversationById(id);
    if (!conversation)
        throw notFound("Conversation not found.");
    const rows = await listMessages(id, {
        beforeSeq: options.before,
        limit: options.limit,
    });
    return {
        data: rows.map(toMessageEvent),
        meta: {
            hasMore: rows.length === options.limit,
            oldestSeq: rows[0]?.seq ?? null,
            newestSeq: rows[rows.length - 1]?.seq ?? null,
        },
    };
};
export const adminUnreadCount = async () => countUnreadConversations();
export const adminCounts = async () => {
    const [unread, open, total] = await Promise.all([
        countUnreadConversations(),
        countOpenConversations(),
        countConversations(),
    ]);
    return { unread, open, total };
};
export const adminUpdateConversation = async (request, id, input) => {
    const existing = await findConversationById(id);
    if (!existing)
        throw notFound("Conversation not found.");
    const patch = {};
    if (input.status !== undefined) {
        patch.status = input.status;
        patch.closedAt =
            input.status === "closed" || input.status === "archived"
                ? new Date()
                : null;
    }
    if (input.starred !== undefined)
        patch.starred = input.starred;
    if (input.isSpam !== undefined)
        patch.isSpam = input.isSpam;
    const updated = await updateConversation(id, patch);
    if (!updated)
        throw notFound("Conversation not found.");
    const action = input.status === "archived"
        ? "archive"
        : input.status === "closed"
            ? "close"
            : input.status
                ? "reopen"
                : "update";
    await audit(request, {
        action: `conversation.${action}`,
        entity: "conversation",
        entityId: id,
        meta: { fields: Object.keys(input) },
    });
    realtime().toAdmins("conversation:update", {
        id,
        patch: conversationView(updated),
    });
    if (input.status === "closed" || input.status === "archived") {
        realtime().closeGuests(id, "chat:closed");
    }
    return conversationView(updated);
};
export const adminDeleteConversation = async (request, id) => {
    const existing = await findConversationById(id);
    if (!existing)
        throw notFound("Conversation not found.");
    await deleteConversation(id);
    await audit(request, {
        action: "conversation.delete",
        entity: "conversation",
        entityId: id,
    });
    realtime().toAdmins("conversation:update", { id, patch: { deleted: true } });
    realtime().closeGuests(id, "chat:closed");
};
/* --------------------------------- messages -------------------------------- */
/** Session token from the Authorization header, or the httpOnly cookie. */
const guestTokenFrom = (request) => {
    const authorization = request.get("authorization");
    if (authorization?.startsWith("Bearer "))
        return authorization.slice(7);
    return readCookie(request, CHAT_SESSION_COOKIE);
};
/** Validate a signed visitor session; the conversation must still be open. */
export const verifyGuestSession = async (token) => {
    if (!token) {
        throw new AppError(401, ERROR_CODES.UNAUTHORIZED, "Chat session required.");
    }
    const payload = await verifyGuestToken(token);
    await assertGuestAccess(payload.conversationId);
    return payload.conversationId;
};
export const guestConversationId = async (request) => verifyGuestSession(guestTokenFrom(request));
/** Rejoin an existing, already verified session (no invite token needed). */
export const guestJoin = async (request) => {
    const conversationId = await guestConversationId(request);
    const conversation = await findConversationById(conversationId);
    if (!conversation) {
        throw new AppError(404, ERROR_CODES.INVITE_INVALID, "This link is not valid.");
    }
    const now = new Date();
    await updateConversation(conversation.id, { visitorLastSeenAt: now });
    await resetUnread(conversation.id, "visitor", now);
    await markDelivered(conversation.id, await latestSeq(conversation.id), "visitor");
    const history = await listMessages(conversation.id, { limit: 50 });
    await audit(request, {
        action: "chat.join",
        entity: "conversation",
        entityId: conversation.id,
    });
    return {
        conversation: guestConversationView(conversation),
        messages: history.map(toMessageEvent),
        developer: { name: OWNER_NAME },
    };
};
export const guestMessages = async (conversationId, options) => {
    const rows = await listMessages(conversationId, {
        beforeSeq: options.before,
        limit: options.limit,
    });
    return {
        data: rows.map(toMessageEvent),
        meta: {
            hasMore: rows.length === options.limit,
            oldestSeq: rows[0]?.seq ?? null,
            newestSeq: rows[rows.length - 1]?.seq ?? null,
        },
    };
};
const deliverIfConnected = async (conversationId, sender) => {
    const otherOnline = sender === "visitor" ? realtime().isAdminOnline() : realtime().isVisitorOnline(conversationId);
    if (!otherOnline)
        return null;
    return markDelivered(conversationId, await latestSeq(conversationId), sender);
};
const updatePreview = async (conversationId, body, at) => {
    await touchConversation(conversationId, body, at);
    return findConversationById(conversationId);
};
const emitNewMessage = async (conversation, message) => {
    const view = conversationView(conversation);
    realtime().toConversation(conversation.id, "message:new", { message });
    realtime().toAdmins("conversation:update", {
        id: conversation.id,
        patch: view,
    });
};
const NOTIFICATION_FOOTER = "You received this email because you contacted Adetoye Daniel Kehinde through his portfolio.";
export const notifyOwnerOfVisitorMessage = async (conversation, body) => {
    if (realtime().isAdminOnline() || realtime().isAdminViewing(conversation.id)) {
        return;
    }
    if (conversation.ownerEmailedAt &&
        Date.now() - conversation.ownerEmailedAt.getTime() < EMAIL_THROTTLE_MS) {
        return;
    }
    if (!env.ownerEmail)
        return;
    const link = adminLink(conversation.id);
    try {
        await sendMail({
            to: env.ownerEmail,
            subject: `New chat message from ${conversation.visitorName}`,
            text: [
                `${conversation.visitorName} sent a new message:`,
                "",
                previewText(body),
                "",
                link ? `Open in Admin: ${link}` : "Open the Admin inbox to reply.",
                NOTIFICATION_FOOTER,
            ].join("\n"),
            html: emailShell(`New message from ${conversation.visitorName}`, [`<span style="color:#475569">${escapeHtml(previewText(body))}</span>`], link ? { label: "Open in Admin", url: link } : undefined, NOTIFICATION_FOOTER),
        });
        await updateConversation(conversation.id, { ownerEmailedAt: new Date() });
    }
    catch (error) {
        logger.error({ err: error }, "Owner chat notification failed");
    }
};
/**
 * The first reply doubles as the invite: if the conversation has no usable
 * link, rotate one in so the visitor can verify their email and join.
 */
const ensureInvite = async (conversation) => {
    if (inviteStatus(conversation) === "active" &&
        conversation.inviteSentAt &&
        conversation.inviteExpiresAt) {
        return {
            token: inviteTokenFor(conversation.id, conversation.inviteSentAt),
            expiresAt: conversation.inviteExpiresAt,
        };
    }
    const sentAt = new Date();
    const expiresAt = new Date(sentAt.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
    const token = inviteTokenFor(conversation.id, sentAt);
    await updateConversation(conversation.id, {
        inviteTokenHash: inviteHashFor(token),
        inviteSentAt: sentAt,
        inviteExpiresAt: expiresAt,
        inviteRevokedAt: null,
    });
    return { token, expiresAt };
};
export const notifyVisitorOfReply = async (conversation, body) => {
    if (realtime().isVisitorOnline(conversation.id))
        return;
    if (conversation.visitorEmailedAt &&
        Date.now() - conversation.visitorEmailedAt.getTime() < EMAIL_THROTTLE_MS) {
        return;
    }
    let token;
    let expiresAt;
    try {
        ({ token, expiresAt } = await ensureInvite(conversation));
    }
    catch (error) {
        logger.error({ err: error, conversationId: conversation.id }, "Could not prepare the chat link for the reply email");
        return;
    }
    const link = chatLinkFor(conversation.id, token);
    try {
        await sendMail({
            to: conversation.visitorEmail,
            replyTo: env.ownerEmail,
            subject: `New reply from ${OWNER_NAME.split(" ")[0]}`,
            text: [
                `You have a new reply from ${OWNER_NAME}:`,
                "",
                previewText(body),
                "",
                `Continue the chat: ${link}`,
                `This link expires on ${expiresAt.toUTCString()}.`,
            ].join("\n"),
            html: emailShell(`New reply from ${OWNER_NAME.split(" ")[0]}`, [`<span style="color:#475569">${escapeHtml(previewText(body))}</span>`], { label: "Continue the chat", url: link }, `${NOTIFICATION_FOOTER} The link expires ${expiresAt.toUTCString()}.`),
        });
        await updateConversation(conversation.id, { visitorEmailedAt: new Date() });
    }
    catch (error) {
        logger.error({ err: error }, "Visitor reply notification failed");
    }
};
export const guestSendMessage = async (conversationId, input) => {
    const conversation = await assertGuestAccess(conversationId);
    const now = Date.now();
    const [lastMinute, lastDay] = await Promise.all([
        countRecentMessages(conversationId, "visitor", new Date(now - 60_000)),
        countRecentMessages(conversationId, "visitor", new Date(now - 24 * 60 * 60 * 1000)),
    ]);
    if (lastMinute >= GUEST_MESSAGES_PER_MINUTE || lastDay >= GUEST_MESSAGES_PER_DAY) {
        throw new AppError(429, ERROR_CODES.RATE_LIMITED, "You're sending messages too quickly. Please wait a moment.");
    }
    const imageKey = assertImageKey(conversationId, input.imageKey);
    const { message, duplicate } = await insertMessage({
        conversationId,
        sender: "visitor",
        body: input.body,
        clientMsgId: input.clientMsgId,
        imageKey,
        imageMimeType: imageKey ? "image/webp" : null,
    });
    if (!duplicate) {
        const preview = messagePreview(input.body, Boolean(imageKey));
        await incrementUnread(conversationId, "admin");
        const updated = await updatePreview(conversationId, preview, message.createdAt);
        const deliveredAt = await deliverIfConnected(conversationId, "visitor");
        await emitNewMessage(updated ?? conversation, toMessageEvent({ ...message, deliveredAt }));
        if (updated)
            void notifyOwnerOfVisitorMessage(updated, preview);
    }
    return toMessageEvent(message);
};
export const adminSendMessage = async (request, conversationId, input) => {
    const conversation = await findConversationById(conversationId);
    if (!conversation)
        throw notFound("Conversation not found.");
    if (conversation.status === "closed" || conversation.status === "archived") {
        throw conflict("Reopen the conversation before replying.");
    }
    const recent = await countRecentMessages(conversationId, "admin", new Date(Date.now() - 60_000));
    if (recent >= ADMIN_MESSAGES_PER_MINUTE) {
        throw new AppError(429, ERROR_CODES.RATE_LIMITED, "You're sending messages too quickly.");
    }
    const imageKey = assertImageKey(conversationId, input.imageKey);
    const { message, duplicate } = await insertMessage({
        conversationId,
        sender: "admin",
        body: input.body,
        clientMsgId: input.clientMsgId,
        imageKey,
        imageMimeType: imageKey ? "image/webp" : null,
    });
    if (!duplicate) {
        const preview = messagePreview(input.body, Boolean(imageKey));
        await incrementUnread(conversationId, "visitor");
        const updated = await updatePreview(conversationId, preview, message.createdAt);
        const deliveredAt = await deliverIfConnected(conversationId, "admin");
        const view = toMessageEvent({ ...message, deliveredAt });
        realtime().toConversation(conversationId, "message:new", { message: view });
        realtime().toAdmins("conversation:update", {
            id: conversationId,
            patch: conversationView(updated ?? conversation),
        });
        if (updated)
            void notifyVisitorOfReply(updated, preview);
        await audit(request, {
            action: "conversation.reply",
            entity: "conversation",
            entityId: conversationId,
        });
    }
    return toMessageEvent(message);
};
export const markSeen = async (conversationId, viewer, upToSeq) => {
    const conversation = await findConversationById(conversationId);
    if (!conversation)
        throw notFound("Conversation not found.");
    const readAt = await markRead(conversationId, upToSeq, viewer);
    const now = new Date();
    await resetUnread(conversationId, viewer === "admin" ? "admin" : "visitor", now);
    realtime().toConversation(conversationId, "message:status", {
        conversationId,
        upToSeq,
        readAt,
    });
    realtime().toAdmins("conversation:update", {
        id: conversationId,
        patch: {
            unreadForAdmin: viewer === "admin" ? 0 : conversation.unreadForAdmin,
            ...(viewer === "admin" ? { adminLastSeenAt: now } : {}),
        },
    });
    return { upToSeq, readAt };
};
/* ---------------------------------- invites -------------------------------- */
const inviteEmail = (conversation, token, note, expiresAt) => {
    const link = chatLinkFor(conversation.id, token);
    const intro = `Hi ${conversation.visitorName.split(" ")[0] ?? "there"},`;
    const paragraphs = [
        `${escapeHtml(intro)}`,
        `Thanks for getting in touch about ${escapeHtml(conversation.subject ?? "your message")}. I'd be happy to continue the conversation live.`,
        ...(note ? [`<em>${escapeHtml(note)}</em>`] : []),
        `This private link lets you chat with me directly — no account needed. It expires on ${escapeHtml(expiresAt.toUTCString())}.`,
    ];
    return {
        subject: `${OWNER_NAME.split(" ")[0]} invited you to chat`,
        text: [
            `Hi ${conversation.visitorName.split(" ")[0] ?? "there"},`,
            "",
            `Thanks for getting in touch about ${conversation.subject ?? "your message"}. I'd be happy to continue the conversation live.`,
            ...(note ? ["", note] : []),
            "",
            `Join the chat: ${link}`,
            `This link expires on ${expiresAt.toUTCString()}.`,
            "",
            NOTIFICATION_FOOTER,
        ].join("\n"),
        html: emailShell(`${OWNER_NAME.split(" ")[0]} invited you to chat`, paragraphs, { label: "Join the chat", url: link }, `${NOTIFICATION_FOOTER} The link expires ${expiresAt.toUTCString()}.`),
    };
};
export const sendInvite = async (request, conversationId, input) => {
    const conversation = await findConversationById(conversationId);
    if (!conversation)
        throw notFound("Conversation not found.");
    if (conversation.status === "closed") {
        throw conflict("Reopen the conversation before inviting the visitor.");
    }
    const sentAt = new Date();
    const expiresAt = new Date(sentAt.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
    const token = inviteTokenFor(conversation.id, sentAt);
    await updateConversation(conversationId, {
        inviteTokenHash: inviteHashFor(token),
        inviteSentAt: sentAt,
        inviteExpiresAt: expiresAt,
        inviteRevokedAt: null,
        ...(conversation.status === "new" ? { status: "open" } : {}),
    });
    let emailSent = false;
    if (input.sendEmail) {
        const email = inviteEmail(conversation, token, input.note, expiresAt);
        try {
            emailSent = await sendMail({
                to: conversation.visitorEmail,
                replyTo: env.ownerEmail,
                subject: email.subject,
                text: email.text,
                html: email.html,
            });
        }
        catch (error) {
            logger.error({ err: error }, "Invite email failed");
        }
    }
    await audit(request, {
        action: input.sendEmail ? "conversation.invite.send" : "conversation.invite.create",
        entity: "conversation",
        entityId: conversationId,
        meta: { emailSent },
    });
    const updated = await findConversationById(conversationId);
    if (updated) {
        realtime().toAdmins("conversation:update", {
            id: conversationId,
            patch: conversationView(updated),
        });
    }
    return {
        link: chatLinkFor(conversationId, token),
        expiresAt,
        emailSent,
        conversation: updated ? conversationView(updated) : null,
    };
};
export const revokeInvite = async (request, conversationId) => {
    const conversation = await findConversationById(conversationId);
    if (!conversation)
        throw notFound("Conversation not found.");
    if (!conversation.inviteTokenHash)
        throw conflict("There is no invite to revoke.");
    await updateConversation(conversationId, { inviteRevokedAt: new Date() });
    realtime().closeGuests(conversationId, "invite:revoked");
    await audit(request, {
        action: "conversation.invite.revoke",
        entity: "conversation",
        entityId: conversationId,
    });
    const updated = await findConversationById(conversationId);
    if (updated) {
        realtime().toAdmins("conversation:update", {
            id: conversationId,
            patch: conversationView(updated),
        });
    }
};
export const guestPresence = async (conversationId) => {
    await updateConversation(conversationId, { visitorLastSeenAt: new Date() });
};
/**
 * Store a chat image in ImageKit (never on disk) and return the key the message
 * row records. Keys are scoped to the conversation they belong to.
 */
export const storeChatImage = async (request, conversationId, file) => {
    if (!file) {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, "An image file is required in the `file` field.");
    }
    const processed = await processImage(file.buffer, file.originalname);
    const key = `chat/${conversationId}/${randomUUID()}.webp`;
    const storage = getStorage();
    await storage.put(key, processed.buffer, processed.contentType);
    await audit(request, {
        action: "chat.image.upload",
        entity: "conversation",
        entityId: conversationId,
        meta: { sizeBytes: processed.buffer.length },
    });
    return {
        key,
        url: storage.publicUrl(key),
        mimeType: processed.contentType,
    };
};
export const hashIpForChat = (request) => sha256Hex(request.ip ?? "unknown");
//# sourceMappingURL=chat.service.js.map
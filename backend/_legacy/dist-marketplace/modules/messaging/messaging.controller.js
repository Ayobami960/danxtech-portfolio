import { asyncHandler } from "../../utils/async-handler.js";
import { createConversation, getConversations, getMessages, markConversationRead, sendMessage, } from "./messaging.service.js";
import { emitConversationUpdate } from "./messaging.events.js";
import { requireClient } from "../proposals/proposals.controller.js";
import { getAgencyIdForMember } from "../agency/agency.service.js";
import { requireText } from "../../config/constants.js";
import { ApiError } from "../../utils/api-error.js";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/png",
    "image/jpeg",
    "text/plain",
]);
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const getId = (value, label) => {
    const id = requireText(typeof value === "string" ? value : undefined, label);
    if (!UUID_RE.test(id)) {
        throw new ApiError(400, `${label} is invalid.`);
    }
    return id;
};
const optionalId = (value, label) => value === undefined || value === null || value === ""
    ? undefined
    : getId(value, label);
/**
 * The dashboards send their role with every messaging call. It is only a
 * consistency check: the authenticated token role is authoritative, so a
 * client cannot read or send as the other side by changing the query string.
 */
const requireRole = (request) => {
    if (!request.auth)
        throw new ApiError(401, "Authentication is required.");
    const queryRole = request.query.role;
    const bodyRole = request.body?.role;
    const requestedRole = queryRole ?? bodyRole;
    if (requestedRole === undefined || requestedRole === "")
        return request.auth;
    if (requestedRole !== "client" && requestedRole !== "freelancer") {
        throw new ApiError(400, "Role is invalid.");
    }
    if (requestedRole !== request.auth.role) {
        throw new ApiError(403, "The requested role does not match the authenticated account.");
    }
    return request.auth;
};
export const listConversations = asyncHandler(async (request, response) => {
    const auth = requireRole(request);
    // The agency dashboard asks for its shared inbox; a personal inbox stays
    // keyed by the account id.
    const scope = request.query.scope === "agency" ? "agency" : "default";
    const agencyId = scope === "agency" ? await getAgencyIdForMember(auth.userId) : null;
    const data = scope === "agency" && !agencyId
        ? { conversations: [], totalUnread: 0 }
        : await getConversations(auth.userId, agencyId);
    response.json({
        success: true,
        message: "Conversations retrieved.",
        data,
    });
});
export const openConversation = asyncHandler(async (request, response) => {
    requireRole(request);
    const auth = requireClient(request);
    const recipientId = optionalId(request.body?.recipientId, "Recipient");
    const jobId = optionalId(request.body?.jobId, "Job post");
    const proposalId = optionalId(request.body?.proposalId, "Proposal");
    const data = await createConversation(auth.userId, {
        ...(recipientId ? { recipientId } : {}),
        ...(jobId ? { jobId } : {}),
        ...(proposalId ? { proposalId } : {}),
    });
    // The freelancer's inbox should show the new thread without a refresh.
    await emitConversationUpdate(data.id, {
        messagesChanged: false,
        senderId: null,
    }).catch((error) => {
        console.error("Failed to emit conversation update.", error);
    });
    response.status(201).json({
        success: true,
        message: "Conversation ready.",
        data,
    });
});
export const createMessage = asyncHandler(async (request, response) => {
    const auth = requireRole(request);
    const body = typeof request.body?.body === "string" ? request.body.body.trim() : "";
    const rawAttachments = Array.isArray(request.body?.attachments)
        ? request.body.attachments
        : [];
    if (!body && !rawAttachments.length) {
        throw new ApiError(400, "Message or attachment is required.");
    }
    if (body.length > 10_000) {
        throw new ApiError(400, "Message cannot exceed 10,000 characters.");
    }
    if (rawAttachments.length > 5) {
        throw new ApiError(400, "A message can contain up to 5 attachments.");
    }
    const attachments = rawAttachments.map((value) => {
        const attachment = value;
        if (!attachment ||
            typeof attachment.fileUrl !== "string" ||
            typeof attachment.fileName !== "string" ||
            !attachment.fileName.trim() ||
            attachment.fileName.length > 255 ||
            !Number.isInteger(attachment.fileSize) ||
            typeof attachment.mimeType !== "string") {
            throw new ApiError(400, "Attachment metadata is invalid.");
        }
        if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(attachment.mimeType)) {
            throw new ApiError(400, "Attachments must be PDF, DOCX, PNG, JPG, or TXT files.");
        }
        const match = /^data:([^;,]+);base64,([a-zA-Z0-9+/=]+)$/.exec(attachment.fileUrl);
        if (!match || match[1] !== attachment.mimeType) {
            throw new ApiError(400, "Attachment file is invalid.");
        }
        const fileSize = Buffer.from(match[2], "base64").byteLength;
        if (!fileSize || fileSize > MAX_ATTACHMENT_BYTES) {
            throw new ApiError(400, "Each attachment must be 5 MB or smaller.");
        }
        return {
            fileId: "",
            fileUrl: attachment.fileUrl,
            fileName: attachment.fileName.trim(),
            mimeType: attachment.mimeType,
            fileSize,
            attachmentType: attachment.mimeType.startsWith("image/")
                ? "IMAGE"
                : "FILE",
        };
    });
    const data = await sendMessage(getId(request.params.conversationId, "Conversation"), auth.userId, {
        body: body || undefined,
        replyToMessageId: optionalId(request.body?.replyToMessageId, "Reply message"),
        attachments,
    });
    response.status(201).json({
        success: true,
        message: "Message sent.",
        data,
    });
});
export const listMessages = asyncHandler(async (request, response) => {
    const auth = requireRole(request);
    const data = await getMessages(getId(request.params.conversationId, "Conversation"), auth.userId, typeof request.query.cursor === "string"
        ? request.query.cursor
        : undefined, Math.min(Math.max(Number(request.query.limit) || 30, 1), 50));
    response.json({
        success: true,
        message: "Messages retrieved.",
        data,
    });
});
export const readConversation = asyncHandler(async (request, response) => {
    const auth = requireRole(request);
    const data = await markConversationRead(getId(request.params.conversationId, "Conversation"), auth.userId, getId(request.body?.lastReadMessageId, "Last read message"));
    await emitConversationUpdate(data.conversationId, {
        messagesChanged: false,
        senderId: null,
    }).catch((error) => {
        console.error("Failed to emit conversation update.", error);
    });
    response.json({
        success: true,
        message: "Conversation marked as read.",
        data,
    });
});
//# sourceMappingURL=messaging.controller.js.map
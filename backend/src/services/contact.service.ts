import type { Request } from "express";
import { logger } from "../config/logger.js";
import { AppError, ERROR_CODES, notFound } from "../lib/errors.js";
import {
  contactMessageHash,
  hashIp,
  sha256Hex,
} from "../lib/crypto.js";
import {
  countAllMessages,
  countUnreadMessages,
  createContactMessage,
  deleteContactMessage,
  findContactMessageById,
  findRecentDuplicate,
  listContactMessages,
  updateContactMessage,
  type ContactFilters,
} from "../repositories/contact.repository.js";
import { audit } from "../repositories/audit-writer.js";
import type {
  ContactSubmission,
  MessageListQuery,
  MessageUpdateInput,
} from "../schemas/contact.schemas.js";
import { sendOwnerNotification, sendVisitorConfirmation } from "./mailer.js";
import { verifyTurnstile } from "./turnstile.service.js";
import {
  adminConversationLink,
  createConversationFromContact,
} from "./chat.service.js";
import type { ContactMessage } from "../database/schema.js";

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

export type SubmitResult = { ok: true };

/**
 * Persist a contact message. The honeypot response is deliberately identical
 * to a real success so bots cannot tell that they were discarded.
 */
export const submit = async (
  request: Request,
  input: ContactSubmission,
): Promise<SubmitResult> => {
  if (input.website && input.website.trim().length > 0) {
    return { ok: true };
  }

  await verifyTurnstile(input.turnstileToken, request.ip);

  const email = input.email.trim().toLowerCase();
  const messageHash = contactMessageHash(email, input.message);
  const duplicate = await findRecentDuplicate(
    email,
    messageHash,
    new Date(Date.now() - DUPLICATE_WINDOW_MS),
  );
  if (duplicate) {
    throw new AppError(
      409,
      ERROR_CODES.DUPLICATE_MESSAGE,
      "This message was already received. Please wait before sending it again.",
    );
  }

  const ipHash = hashIp(request.ip) ?? sha256Hex("unknown-ip");
  const message = await createContactMessage({
    name: input.name,
    email,
    subject: input.subject ?? null,
    message: input.message,
    messageHash,
    ipHash,
    userAgent: request.get("user-agent")?.slice(0, 1000) ?? null,
  });

  // A contact submission opens a conversation whose first message is the
  // visitor's text. Replying/inviting later happens in the live chat module.
  const conversation = await createConversationFromContact({
    contactMessageId: message.id,
    name: message.name,
    email: message.email,
    subject: message.subject,
    message: message.message,
    ipHash,
  });

  // Fire-and-forget: a mail outage must never fail the visitor's request.
  void sendOwnerNotification(
    message,
    conversation ? adminConversationLink(conversation.id) : null,
  )
    .then(async () => {
      await updateContactMessage(message.id, { notifiedAt: new Date() });
    })
    .catch((error: unknown) => {
      logger.error(
        { err: error, messageId: message.id },
        "Contact notification email failed",
      );
    });

  void sendVisitorConfirmation(message).catch((error: unknown) => {
    logger.error(
      { err: error, messageId: message.id },
      "Visitor confirmation email failed",
    );
  });

  return { ok: true };
};

export const listMessages = async (filters: MessageListQuery) => {
  const contactFilters: ContactFilters = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.starred !== undefined ? { starred: filters.starred } : {}),
    ...(filters.isSpam !== undefined ? { isSpam: filters.isSpam } : {}),
    ...(filters.q ? { q: filters.q } : {}),
  };
  return listContactMessages(contactFilters, filters.page, filters.pageSize);
};

export const unreadCount = async (): Promise<number> =>
  countUnreadMessages();

export const totalCount = async (): Promise<number> => countAllMessages();

export const getMessage = async (id: string): Promise<ContactMessage> => {
  const message = await findContactMessageById(id);
  if (!message) throw notFound("Message not found.");
  return message;
};

export const updateMessage = async (
  request: Request,
  id: string,
  input: MessageUpdateInput,
): Promise<ContactMessage> => {
  const existing = await findContactMessageById(id);
  if (!existing) throw notFound("Message not found.");

  const updated = await updateContactMessage(id, input);
  if (!updated) throw notFound("Message not found.");

  await audit(request, {
    action: "message.update",
    entity: "message",
    entityId: id,
    meta: { fields: Object.keys(input) },
  });
  return updated;
};

export const deleteMessage = async (
  request: Request,
  id: string,
): Promise<void> => {
  const existing = await findContactMessageById(id);
  if (!existing) throw notFound("Message not found.");

  await deleteContactMessage(id);
  await audit(request, {
    action: "message.delete",
    entity: "message",
    entityId: id,
  });
};

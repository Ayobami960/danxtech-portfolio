import { z } from "zod";
import { paginationSchema } from "../lib/pagination.js";
import { queryBoolean } from "./common.schemas.js";

export const MAX_MESSAGE_LENGTH = 2000;

/** Trim, strip control characters and collapse three or more blank lines. */
export const normalizeMessageBody = (value: string): string =>
  value
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const messageBodySchema = z
  .string()
  .max(MAX_MESSAGE_LENGTH, "Messages must be 2000 characters or fewer.")
  .transform(normalizeMessageBody)
  .refine((value) => value.length >= 1, "Message cannot be empty.")
  .refine(
    (value) => value.length <= MAX_MESSAGE_LENGTH,
    "Messages must be 2000 characters or fewer.",
  );

export const clientMsgIdSchema = z.uuid();

/** An ImageKit key produced by the chat upload endpoint for this conversation. */
export const chatImageKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .regex(/^chat\/[0-9a-fA-F-]{36}\/[A-Za-z0-9._-]+$/, "Invalid image reference.");

/** An image can be sent on its own; text-only messages must not be empty. */
export const chatSendSchema = z
  .object({
    clientMsgId: clientMsgIdSchema,
    body: z
      .string()
      .max(MAX_MESSAGE_LENGTH, "Messages must be 2000 characters or fewer.")
      .transform(normalizeMessageBody)
      .default(""),
    imageKey: chatImageKeySchema.optional(),
  })
  .strict()
  .refine((value) => value.body.length >= 1 || value.imageKey !== undefined, {
    message: "Message cannot be empty.",
    path: ["body"],
  });

/** Step 1 of the visitor flow: both link parts plus the email they used. */
export const chatVerificationRequestSchema = z
  .object({
    conversationId: z.uuid(),
    token: z.string().trim().min(20).max(200),
    email: z.email().max(255),
  })
  .strict();

/** Step 2: the six-digit code from the email. */
export const chatVerificationConfirmSchema = z
  .object({
    conversationId: z.uuid(),
    token: z.string().trim().min(20).max(200),
    email: z.email().max(255),
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Enter the 6-digit code."),
  })
  .strict();

export const chatSeenSchema = z
  .object({ upToSeq: z.coerce.number().int().min(0) })
  .strict();

export const chatMessagesQuerySchema = z
  .object({
    before: z.coerce.number().int().min(1).optional(),
    after: z.coerce.number().int().min(0).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    token: z.string().trim().min(20).max(200).optional(),
  })
  .strict();

export const conversationListQuerySchema = paginationSchema
  .extend({
    status: z.enum(["new", "open", "closed", "archived"]).optional(),
    starred: queryBoolean.optional(),
    isSpam: queryBoolean.optional(),
    unread: queryBoolean.optional(),
    q: z.string().trim().max(200).optional(),
  })
  .strict();

export const updateConversationSchema = z
  .object({
    status: z.enum(["new", "open", "closed", "archived"]).optional(),
    starred: z.boolean().optional(),
    isSpam: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export const inviteSchema = z
  .object({
    note: z.string().trim().max(500).optional(),
    sendEmail: z.boolean().default(true),
  })
  .strict();

export const conversationMessageParams = z
  .object({ id: z.uuid() })
  .strict();

export type ChatSendInput = z.infer<typeof chatSendSchema>;
export type ChatVerificationRequestInput = z.infer<
  typeof chatVerificationRequestSchema
>;
export type ChatVerificationConfirmInput = z.infer<
  typeof chatVerificationConfirmSchema
>;
export type ConversationListQuery = z.infer<typeof conversationListQuerySchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
export type InviteInput = z.infer<typeof inviteSchema>;

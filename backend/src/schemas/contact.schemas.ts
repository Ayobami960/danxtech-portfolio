import { z } from "zod";
import { paginationSchema } from "../lib/pagination.js";
import { queryBoolean } from "./common.schemas.js";

export const contactSubmissionSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.email().max(255),
    subject: z.string().trim().max(120).optional(),
    message: z.string().trim().min(10).max(1000),
    /** Hidden honeypot: must be absent or empty. */
    website: z.string().max(200).optional(),
    turnstileToken: z.string().max(4096).optional(),
  })
  .strict();

export const messageListQuerySchema = paginationSchema
  .extend({
    status: z.enum(["unread", "read", "archived"]).optional(),
    starred: queryBoolean.optional(),
    isSpam: queryBoolean.optional(),
    q: z.string().trim().max(200).optional(),
  })
  .strict();

export const updateMessageSchema = z
  .object({
    status: z.enum(["unread", "read", "archived"]).optional(),
    starred: z.boolean().optional(),
    isSpam: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export type ContactSubmission = z.infer<typeof contactSubmissionSchema>;
export type MessageListQuery = z.infer<typeof messageListQuerySchema>;
export type MessageUpdateInput = z.infer<typeof updateMessageSchema>;

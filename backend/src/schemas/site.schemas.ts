import { z } from "zod";

/* ---------------------------------- about ---------------------------------- */

export const aboutInputSchema = z
  .object({
    paragraphs: z.array(z.string().trim().min(1).max(1200)).min(1).max(6),
    tags: z.array(z.string().trim().min(1).max(30)).max(12),
    metrics: z
      .array(
        z
          .object({
            value: z.string().trim().min(1).max(10),
            label: z.string().trim().min(1).max(40),
          })
          .strict(),
      )
      .max(4),
    principles: z
      .array(
        z
          .object({
            icon: z.string().trim().min(1).max(16),
            title: z.string().trim().min(1).max(60),
            body: z.string().trim().min(1).max(300),
          })
          .strict(),
      )
      .max(6),
  })
  .strict();

export type AboutInput = z.infer<typeof aboutInputSchema>;

/* -------------------------------- credentials ------------------------------- */

const credentialFields = {
  kind: z.enum(["degree", "certification"]),
  title: z.string().trim().min(1).max(160),
  issuer: z.string().trim().max(160),
  period: z.string().trim().max(60).nullish(),
  detail: z.string().trim().max(200).nullish(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
};

export const createCredentialSchema = z
  .object({
    kind: credentialFields.kind,
    title: credentialFields.title,
    issuer: credentialFields.issuer.default(""),
    period: credentialFields.period,
    detail: credentialFields.detail,
    sortOrder: credentialFields.sortOrder,
  })
  .strict();

export const updateCredentialSchema = z
  .object({
    kind: credentialFields.kind.optional(),
    title: credentialFields.title.optional(),
    issuer: credentialFields.issuer.optional(),
    period: credentialFields.period.optional(),
    detail: credentialFields.detail.optional(),
    sortOrder: credentialFields.sortOrder,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export type CreateCredentialInput = z.infer<typeof createCredentialSchema>;
export type UpdateCredentialInput = z.infer<typeof updateCredentialSchema>;

/* --------------------------------- settings -------------------------------- */

export const settingsInputSchema = z
  .object({
    contactEmail: z.email().max(255),
    phone: z
      .string()
      .trim()
      .refine((value) => value === "" || /^[+\d\s()-]{6,40}$/.test(value), {
        message: "Enter a valid phone number or leave it empty.",
      }),
    location: z.string().trim().max(100),
  })
  .strict();

export type SettingsInput = z.infer<typeof settingsInputSchema>;

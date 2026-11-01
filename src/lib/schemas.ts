import { z } from "zod";

const httpsUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => value === "" || /^https:\/\//.test(value), {
    message: "Use an https:// URL.",
  });

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour.");

const socialUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => /^(https:\/\/|mailto:)/.test(value), {
    message: "Use https:// (mailto: is allowed for email).",
  });

export const heroSchema = z.object({
  nameParts: z
    .array(z.string().trim().min(1).max(30))
    .min(1, "At least one name part.")
    .max(4),
  typingPhrases: z
    .array(z.string().trim().min(1).max(60))
    .min(1, "Add at least one phrase.")
    .max(10),
  intro: z.string().max(400),
  location: z.string().max(100),
  isAvailable: z.boolean(),
  availabilityLabel: z.string().trim().min(1).max(120),
  stats: z
    .array(
      z.object({
        value: z.string().trim().min(1).max(12),
        label: z.string().trim().min(1).max(30),
      }),
    )
    .max(4),
  socials: z
    .array(
      z.object({
        platform: z.enum(["github", "linkedin", "twitter", "email"]),
        url: socialUrl,
      }),
    )
    .max(10),
});

/**
 * Project fields only. The cover, gallery and PDF are uploaded straight to
 * Cloudinary from here and attached with their own requests, so they are not
 * part of this form's payload.
 */
export const projectSchema = z.object({
  title: z.string().trim().min(2, "At least 2 characters.").max(80),
  description: z.string().max(600),
  icon: z.string().trim().min(1).max(16),
  accentColor: hexColor,
  tech: z.array(z.string().trim().min(1).max(40)).max(15),
  stats: z.array(z.string().trim().min(1).max(60)).max(6),
  liveUrl: httpsUrl,
  githubUrl: httpsUrl,
  published: z.boolean(),
});

export type ProjectFormValues = z.infer<typeof projectSchema>;

export const aboutSchema = z.object({
  paragraphs: z
    .array(z.string().trim().min(1).max(1200))
    .min(1, "Add at least one paragraph.")
    .max(6),
  tags: z.array(z.string().trim().min(1).max(30)).max(12),
  metrics: z
    .array(
      z.object({
        value: z.string().trim().min(1).max(10),
        label: z.string().trim().min(1).max(40),
      }),
    )
    .max(4),
  principles: z
    .array(
      z.object({
        icon: z.string().trim().min(1).max(16),
        title: z.string().trim().min(1).max(60),
        body: z.string().trim().min(1).max(300),
      }),
    )
    .max(6),
});

export const credentialSchema = z.object({
  kind: z.enum(["degree", "certification"]),
  title: z.string().trim().min(1).max(160),
  issuer: z.string().trim().max(160),
  period: z.string().trim().max(60),
  detail: z.string().trim().max(200),
});

export const experienceSchema = z.object({
  type: z.enum(["engineering", "security"]),
  role: z.string().trim().min(1).max(120),
  company: z.string().trim().min(1).max(120),
  period: z.string().trim().min(1).max(60),
  isCurrent: z.boolean(),
  color: hexColor,
  highlights: z.array(z.string().trim().min(1).max(300)).max(12),
});

export const skillSchema = z.object({
  title: z.string().trim().min(1).max(80),
  icon: z.string().trim().min(1).max(16),
  color: hexColor,
  items: z.array(z.string().trim().min(1).max(40)).max(40),
});

export const focusSchema = z.object({
  title: z.string().trim().min(1).max(120),
  icon: z.string().trim().min(1).max(16),
  color: hexColor,
  description: z.string().max(400),
  skills: z.array(z.string().trim().min(1).max(60)).max(12),
});

export const owaspSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^A\d{2}$/, "Use the A01–A10 format."),
  name: z.string().trim().min(1).max(120),
  covered: z.boolean(),
});

export const securityStatSchema = z.object({
  icon: z.string().trim().min(1).max(16),
  label: z.string().trim().min(1).max(60),
  value: z.string().trim().min(1).max(20),
});

export const settingsSchema = z.object({
  contactEmail: z.email("Enter a valid email."),
  phone: z
    .string()
    .trim()
    .refine((value) => value === "" || /^[+\d\s()-]{6,40}$/.test(value), {
      message: "Enter a valid phone number or leave it empty.",
    }),
  location: z.string().trim().max(100),
});

export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z.string().min(12, "Use at least 12 characters.").max(200),
    confirmPassword: z.string().min(1, "Confirm the new password."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "Choose a different password.",
    path: ["newPassword"],
  });

export type HeroForm = z.infer<typeof heroSchema>;
export type ProjectForm = z.infer<typeof projectSchema>;
export type AboutForm = z.infer<typeof aboutSchema>;

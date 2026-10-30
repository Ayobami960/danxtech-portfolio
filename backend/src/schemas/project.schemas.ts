import { z } from "zod";
import { MAX_DOCUMENT_BYTES } from "../config/constants.js";
import { nullableHttpsUrl } from "./common.schemas.js";

const accentColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "accentColor must be a 6-digit hex colour.");

const tag = (max: number) => z.string().trim().min(1).max(max);

/** Cloudinary public_ids accepted from the admin all live under portfolio/. */
export const cloudinaryPublicId = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine(
    (value) => value.startsWith("portfolio/") && !value.includes(".."),
    "publicId must start with portfolio/.",
  );

/**
 * JSON result of a direct browser -> Cloudinary signed upload. The backend
 * never receives the file bytes: it only stores the URL and public_id that
 * Cloudinary returned for the upload it signed.
 */
export const signedUploadResultSchema = z
  .object({
    url: z.url().refine((value) => value.startsWith("https://"), {
      message: "url must use https.",
    }),
    publicId: cloudinaryPublicId,
  })
  .strict();

export const signedUploadListSchema = z
  .object({
    results: z.array(signedUploadResultSchema).min(1).max(10),
  })
  .strict();

/**
 * A PDF attached to a project. Its bytes live in Cloudinary, uploaded through
 * the `resume` signed preset (the only raw preset); the columns store the
 * delivery URL, the public_id used for deletion, and display metadata.
 */
const projectDocument = z
  .object({
    url: z.url().refine((value) => value.startsWith("https://"), {
      message: "document.url must use https.",
    }),
    publicId: cloudinaryPublicId,
    name: z.string().trim().min(1).max(255),
    sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_BYTES),
  })
  .strict();

const baseProject = {
  title: z.string().trim().min(2).max(80),
  description: z.string().max(600),
  icon: z.string().trim().min(1).max(16),
  accentColor,
  tech: z.array(tag(40)).max(15),
  stats: z.array(tag(60)).max(6),
  liveUrl: nullableHttpsUrl.optional(),
  githubUrl: nullableHttpsUrl.optional(),
  /** `null` clears the attached document; omitted leaves it untouched. */
  document: projectDocument.nullable().optional(),
  published: z.boolean(),
  sortOrder: z.number().int().min(0).max(10_000),
};

export const createProjectSchema = z
  .object({
    ...baseProject,
    description: baseProject.description.default(""),
    icon: baseProject.icon.default("🚀"),
    accentColor: baseProject.accentColor.default("#3b82f6"),
    tech: baseProject.tech.default([]),
    stats: baseProject.stats.default([]),
    published: baseProject.published.default(false),
    sortOrder: baseProject.sortOrder.optional(),
  })
  .strict();

export const updateProjectSchema = z
  .object({
    ...baseProject,
    slug: z
      .string()
      .trim()
      .min(2)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case."),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type SignedUploadResultInput = z.infer<typeof signedUploadResultSchema>;

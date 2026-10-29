import { z } from "zod";
import { MAX_DOCUMENT_BYTES } from "../config/constants.js";
import { nullableHttpsUrl } from "./common.schemas.js";

const accentColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "accentColor must be a 6-digit hex colour.");

const tag = (max: number) => z.string().trim().min(1).max(max);

/**
 * A PDF uploaded through `POST /api/v1/admin/documents`. The client sends the
 * metadata ImageKit returned; the service checks the URL belongs to the
 * configured endpoint so a project can never point at an arbitrary file.
 */
const projectDocument = z
  .object({
    url: z
      .url()
      .refine(
        (value) => value.startsWith("https://"),
        "document.url must use https.",
      ),
    fileId: z.string().trim().min(1).max(255).nullable(),
    key: z.string().trim().min(1).max(1024),
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

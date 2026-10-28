import { z } from "zod";
import { nullableHttpsUrl } from "./common.schemas.js";

const accentColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "accentColor must be a 6-digit hex colour.");

const tag = (max: number) => z.string().trim().min(1).max(max);

const baseProject = {
  title: z.string().trim().min(2).max(80),
  description: z.string().max(600),
  icon: z.string().trim().min(1).max(16),
  accentColor,
  tech: z.array(tag(40)).max(15),
  stats: z.array(tag(60)).max(6),
  liveUrl: nullableHttpsUrl.optional(),
  githubUrl: nullableHttpsUrl.optional(),
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

import { z } from "zod";

export const projectListQuerySchema = z
  .object({
    tech: z.string().trim().min(1).max(40).optional(),
  })
  .strict();

export const projectSlugParamsSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case."),
  })
  .strict();

export const resumeDownloadQuerySchema = z
  .object({
    inline: z.enum(["1", "true", "0", "false"]).optional(),
    // Cache-buster the site appends so a replaced PDF is not served from a
    // browser or CDN cache. Only the value matters to the browser, not here.
    v: z.string().trim().max(64).optional(),
  })
  .strict();

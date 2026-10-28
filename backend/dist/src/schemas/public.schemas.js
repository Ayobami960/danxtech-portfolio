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
})
    .strict();
//# sourceMappingURL=public.schemas.js.map
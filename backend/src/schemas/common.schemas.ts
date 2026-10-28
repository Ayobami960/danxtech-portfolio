import { z } from "zod";

export const httpsUrlSchema = z
  .url()
  .max(2048)
  .refine((value) => new URL(value).protocol === "https:", {
    message: "URL must use https://",
  });

export const nullableHttpsUrl = z.preprocess(
  (value) => {
    if (typeof value === "string" && value.trim() === "") return null;
    return value;
  },
  httpsUrlSchema.nullable(),
);

export const uuidParams = z.object({ id: z.uuid() }).strict();

export const projectImageParams = z
  .object({ id: z.uuid(), imageId: z.uuid() })
  .strict();

export const queryBoolean = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

export const reorderSchema = z
  .object({
    ids: z.array(z.uuid()).min(1).max(200),
  })
  .strict();

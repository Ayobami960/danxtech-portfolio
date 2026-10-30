import { z } from "zod";

/**
 * `DELETE /api/v1/admin/documents/:fileId?key=portfolio/...`. The storage key
 * is required so the endpoint can only ever delete files it uploaded itself.
 * Uploads themselves are JSON only: see `signedUploadResultSchema`.
 */
export const documentDeleteParams = z.object({
  fileId: z.string().trim().min(1).max(255),
});

export const documentDeleteQuery = z.object({
  key: z.string().trim().min(1).max(1024),
});

export type DocumentDeleteParams = z.infer<typeof documentDeleteParams>;
export type DocumentDeleteQuery = z.infer<typeof documentDeleteQuery>;

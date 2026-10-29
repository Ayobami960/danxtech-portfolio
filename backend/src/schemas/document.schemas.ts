import { z } from "zod";

/**
 * Body of `POST /api/v1/admin/documents`. The payload size, base64 format and
 * MIME type are validated by `parseDataUrl`, which can compute the decoded size
 * and return a 413 that names the limit.
 */
export const documentUploadSchema = z.object({
  /** Original file name, kept for display; never used as a storage key. */
  fileName: z.string().trim().max(255).optional(),
  dataUrl: z.string().min(1, "A base64 data URL is required."),
});

export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;

/**
 * `DELETE /api/v1/admin/documents/:fileId?key=documents/...`. The storage key
 * is required so the endpoint can only ever delete files it uploaded itself.
 */
export const documentDeleteParams = z.object({
  fileId: z.string().trim().min(1).max(255),
});

export const documentDeleteQuery = z.object({
  key: z.string().trim().min(1).max(1024),
});

export type DocumentDeleteParams = z.infer<typeof documentDeleteParams>;
export type DocumentDeleteQuery = z.infer<typeof documentDeleteQuery>;

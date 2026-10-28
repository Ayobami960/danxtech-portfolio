import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { resumes, type Resume } from "../database/schema.js";
import { RESUME_ID } from "../config/constants.js";

/** The PDF bytes live in `data`; every read path except the download skips it. */
export type ResumeMetadata = Omit<Resume, "data">;

const metadataColumns = {
  id: resumes.id,
  storageKey: resumes.storageKey,
  originalName: resumes.originalName,
  mimeType: resumes.mimeType,
  sizeBytes: resumes.sizeBytes,
  sha256: resumes.sha256,
  downloadCount: resumes.downloadCount,
  uploadedAt: resumes.uploadedAt,
  updatedAt: resumes.updatedAt,
};

export const getResume = async (): Promise<ResumeMetadata | null> => {
  const rows = await db
    .select(metadataColumns)
    .from(resumes)
    .where(eq(resumes.id, RESUME_ID))
    .limit(1);
  return rows[0] ?? null;
};

export type ResumeDocument = {
  data: Buffer;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
};

export const getResumeDocument = async (): Promise<ResumeDocument | null> => {
  const rows = await db
    .select({
      data: resumes.data,
      originalName: resumes.originalName,
      mimeType: resumes.mimeType,
      sizeBytes: resumes.sizeBytes,
      sha256: resumes.sha256,
    })
    .from(resumes)
    .where(eq(resumes.id, RESUME_ID))
    .limit(1);
  const row = rows[0];
  if (!row || !row.data) return null;
  return {
    data: row.data,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    sha256: row.sha256,
  };
};

/**
 * Replace the singleton row. `storage_key` is cleared because the document now
 * lives in the database; the caller deletes the previous ImageKit object only
 * after this write succeeds.
 */
export const upsertResume = async (input: {
  data: Buffer;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}): Promise<ResumeMetadata> => {
  const now = new Date();
  const rows = await db
    .insert(resumes)
    .values({ ...input, storageKey: null, id: RESUME_ID, uploadedAt: now })
    .onConflictDoUpdate({
      target: resumes.id,
      set: {
        data: input.data,
        originalName: input.originalName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        sha256: input.sha256,
        storageKey: null,
        uploadedAt: now,
        updatedAt: now,
      },
    })
    .returning(metadataColumns);
  const resume = rows[0];
  if (!resume) throw new Error("Failed to save the resume.");
  return resume;
};

export const deleteResume = async (): Promise<ResumeMetadata | null> => {
  const rows = await db
    .delete(resumes)
    .where(eq(resumes.id, RESUME_ID))
    .returning(metadataColumns);
  return rows[0] ?? null;
};

export const incrementResumeDownloadCount = async (): Promise<void> => {
  await db
    .update(resumes)
    .set({
      downloadCount: sql`${resumes.downloadCount} + 1`,
      // Keep `updated_at` meaning "the file changed": a download is not an edit.
      updatedAt: sql`${resumes.updatedAt}`,
    })
    .where(eq(resumes.id, RESUME_ID));
};

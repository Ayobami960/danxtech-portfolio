// resume.service.ts
import type { Request } from "express";
import { Readable } from "node:stream";
import { notFound } from "../lib/errors.js";
import { logger } from "../config/logger.js";
import {
  deleteResume,
  getResume,
  getResumeDocument,
  incrementResumeDownloadCount,
  upsertResume,
} from "../repositories/resume.repository.js";
import { audit } from "../repositories/audit-writer.js";
import { REVALIDATE_TAGS } from "../config/constants.js";
import { contentUpdated } from "./revalidate.service.js";
import { deleteStoredFile } from "../storage/index.js";
import { validateSignedUpload } from "../lib/uploads.js";
import type { SignedUploadResultInput } from "../schemas/project.schemas.js";
import type { ResumeMetadata as ResumeRow } from "../repositories/resume.repository.js";

export type ResumeMetadata =
  | { available: false }
  | {
      available: true;
      fileName: string;
      sizeBytes: number;
      updatedAt: Date;
      downloadUrl: string;
    };

/** The version query busts the PDF cache after a replacement. */
export const resumeDownloadUrl = (updatedAt: Date): string =>
  `/api/v1/resume/download?v=${updatedAt.getTime()}`;

export const toPublicMetadata = (resume: ResumeRow | null): ResumeMetadata => {
  if (!resume) return { available: false };
  return {
    available: true,
    fileName: resume.originalName,
    sizeBytes: resume.sizeBytes ?? 0,
    updatedAt: resume.updatedAt,
    downloadUrl: resumeDownloadUrl(resume.updatedAt),
  };
};

export const readMetadata = async (): Promise<ResumeMetadata> =>
  toPublicMetadata(await getResume());

export const readAdminMetadata = async () => {
  const resume = await getResume();
  if (!resume) return null;
  return {
    id: resume.id,
    fileName: resume.originalName,
    mimeType: resume.mimeType,
    sizeBytes: resume.sizeBytes ?? 0,
    downloadCount: resume.downloadCount,
    uploadedAt: resume.uploadedAt,
    updatedAt: resume.updatedAt,
    publicId: resume.publicId,
  };
};

/**
 * Safe replacement flow for the signed-upload path:
 *   1. validate the signed Cloudinary result (portfolio/ publicId)
 *   2. write the singleton row (one transaction)
 *   3. only then delete the previous Cloudinary object, if it is a different
 *      public_id. The `resume` preset always uploads to the same public_id, so
 *      a replacement has already overwritten the old object in place.
 */
export const uploadResume = async (
  request: Request,
  uploaded: SignedUploadResultInput,
): Promise<ResumeMetadata> => {
  const validated = validateSignedUpload(uploaded);
  const previous = await getResume();

  const saved = await upsertResume({
    url: validated.url,
    publicId: validated.publicId,
    originalName: "resume.pdf",
    mimeType: "application/pdf",
  });

  const replaceable =
    previous?.publicId !== null &&
    previous?.publicId !== undefined &&
    previous.publicId !== validated.publicId;

  if (replaceable) {
    await deleteStoredFile({
      fileId: previous.publicId,
      resourceType: "raw",
    }).catch((error: unknown) => {
      logger.warn(
        { err: error, publicId: previous.publicId },
        "Failed to delete the replaced resume object",
      );
    });
  }

  await audit(request, {
    action: "resume.upload",
    entity: "resume",
    entityId: "resume",
    meta: { publicId: validated.publicId },
  });
  contentUpdated("resume", [...REVALIDATE_TAGS.resume]);

  return toPublicMetadata(saved);
};

export const removeResume = async (request: Request): Promise<void> => {
  const removed = await deleteResume();
  if (!removed) throw notFound("No resume exists.");

  await audit(request, {
    action: "resume.delete",
    entity: "resume",
    entityId: "resume",
  });
  contentUpdated("resume", [...REVALIDATE_TAGS.resume]);

  if (removed.publicId) {
    try {
      await deleteStoredFile({ fileId: removed.publicId, resourceType: "raw" });
    } catch (error) {
      logger.warn(
        { err: error, publicId: removed.publicId },
        "Failed to delete the resume object",
      );
    }
  }
};

/**
 * Where the download route should send the browser. Cloudinary-hosted rows are
 * a redirect; legacy rows still stream their bytes out of PostgreSQL.
 */
export type ResumeSource =
  | { kind: "url"; resume: ResumeRow; url: string }
  | { kind: "stream"; resume: ResumeRow; stream: Readable };

export const getDownload = async (): Promise<ResumeSource> => {
  const resume = await getResume();
  if (!resume) throw notFound("No resume is available.");

  if (resume.url) {
    return { kind: "url", resume, url: resume.url };
  }

  const document = await getResumeDocument();
  if (!document) throw notFound("No resume is available.");

  return {
    kind: "stream",
    resume,
    stream: Readable.from(document.data),
  };
};

export const countDownload = async (): Promise<void> => {
  await incrementResumeDownloadCount();
};

/** Local-only convenience for tests that need a fresh read stream type. */
export const isReadable = (value: unknown): value is Readable =>
  typeof value === "object" && value !== null && "pipe" in value;

import type { Request } from "express";
import { logger } from "../config/logger.js";
import { AppError, ERROR_CODES, conflict } from "../lib/errors.js";
import { audit } from "../repositories/audit-writer.js";
import { findProjectByDocumentFileId } from "../repositories/project.repository.js";
import { deleteStoredFile } from "../storage/index.js";
import {
  storageKeyFromPublicId,
  type SignedUploadResult,
  validateSignedUpload,
} from "../lib/uploads.js";

/** Portfolio documents are PDFs; widen this list if other formats are needed. */
const FOLDER = "documents";

export type UploadedDocument = {
  /** Cloudinary public_id used to delete the object later. */
  fileId: string | null;
  /** Storage key / public_id inside Cloudinary (no leading slash). */
  key: string;
  /** Public delivery URL built from Cloudinary's configured delivery base. */
  url: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
};

/** Display name only: the storage key is generated, never taken from input. */
const displayName = (value: string | undefined): string => {
  const cleaned = (value ?? "")
    .replace(/[\\/\0\r\n]/g, "")
    .trim()
    .slice(0, 255);
  return cleaned === "" ? "document.pdf" : cleaned;
};

/**
 * Accept a signed Cloudinary upload result from the admin and attest that the
 * document was uploaded directly to Cloudinary. The backend never sees the file
 * bytes, so there is no Vercel body-size limit for document uploads.
 */
export const uploadPortfolioDocument = async (
  request: Request,
  input: SignedUploadResult,
): Promise<UploadedDocument> => {
  // Documents are uploaded with the `resume` preset: the only raw preset, which
  // is what Cloudinary needs to store a PDF.
  const validated = validateSignedUpload(input);
  const key = storageKeyFromPublicId(validated.publicId);

  await audit(request, {
    action: "document.upload",
    entity: "document",
    entityId: validated.publicId,
    meta: { key, publicId: validated.publicId, sizeBytes: 0 },
  });

  return {
    fileId: validated.publicId,
    key,
    url: validated.url,
    name: displayName(undefined),
    mimeType: "application/pdf",
    sizeBytes: 0,
  };
};

/**
 * Remove an upload that was never attached to a project, so an abandoned
 * upload does not stay in Cloudinary forever. Attached documents are refused:
 * they must be detached from the project first, otherwise the project would
 * keep a dead link.
 */
export const deleteUploadedDocument = async (
  request: Request,
  target: { fileId: string; key: string },
): Promise<void> => {
  if (!target.key.startsWith(`${FOLDER}/`)) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      "Only documents uploaded through this endpoint can be deleted here.",
    );
  }

  const attached = await findProjectByDocumentFileId(target.fileId);
  if (attached) {
    throw conflict(
      `This document is attached to the project "${attached.slug}". Remove it from the project first.`,
    );
  }

  try {
    await deleteStoredFile({
      fileId: target.fileId,
      key: target.key,
      resourceType: "raw",
    });
  } catch (error) {
    const record = error as
      | { message?: unknown; statusCode?: unknown; result?: unknown }
      | null
      | undefined;
    logger.error(
      {
        fileId: target.fileId,
        statusCode:
          typeof record?.statusCode === "number"
            ? record.statusCode
            : undefined,
        cloudinaryResult:
          typeof record?.result === "string" ? record.result : undefined,
        message:
          typeof record?.message === "string"
            ? record.message
            : error instanceof Error
              ? error.message
              : String(error),
      },
      "Failed to delete a stored document",
    );
    throw new AppError(
      502,
      ERROR_CODES.SERVICE_UNAVAILABLE,
      "The document could not be removed from storage right now. Please try again.",
    );
  }

  await audit(request, {
    action: "document.delete",
    entity: "document",
    entityId: target.fileId,
    meta: { key: target.key },
  });
};

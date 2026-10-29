import type { Request } from "express";
import { randomUUID } from "node:crypto";
import { MAX_DOCUMENT_BYTES } from "../config/constants.js";
import { logger } from "../config/logger.js";
import { parseDataUrl } from "../lib/data-url.js";
import { AppError, ERROR_CODES, conflict } from "../lib/errors.js";
import { audit } from "../repositories/audit-writer.js";
import { findProjectByDocumentFileId } from "../repositories/project.repository.js";
import type { DocumentUploadInput } from "../schemas/document.schemas.js";
import { deleteStoredFile, getStorage } from "../storage/index.js";
import { assertPdf } from "./pdf.service.js";

/** Portfolio documents are PDFs; widen this list if other formats are needed. */
const ALLOWED_MIME_TYPES = ["application/pdf"] as const;
const FOLDER = "documents";

export type UploadedDocument = {
  /** ImageKit's id, used to delete the object later. */
  fileId: string | null;
  /** Storage key inside ImageKit (no leading slash). */
  key: string;
  /** Public delivery URL built from IMAGEKIT_URL_ENDPOINT. */
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
 * Accept a base64 JSON payload and store it through the same driver as every
 * other upload, so validation, retries, error mapping and the fileId/url
 * bookkeeping stay in one place.
 */
export const uploadPortfolioDocument = async (
  request: Request,
  input: DocumentUploadInput,
): Promise<UploadedDocument> => {
  const { mimeType, buffer } = parseDataUrl(input.dataUrl, {
    allowedMimeTypes: ALLOWED_MIME_TYPES,
    maxBytes: MAX_DOCUMENT_BYTES,
    label: "The document",
  });

  const name = displayName(input.fileName);
  assertPdf(buffer, name, "The document");

  const year = new Date().getUTCFullYear();
  const key = `${FOLDER}/${year}/${randomUUID()}.pdf`;
  const stored = await getStorage().put(key, buffer, mimeType);

  await audit(request, {
    action: "document.upload",
    entity: "document",
    entityId: stored.fileId ?? stored.key,
    meta: { key: stored.key, sizeBytes: buffer.length },
  });

  return {
    fileId: stored.fileId,
    key: stored.key,
    url: stored.url,
    name,
    mimeType,
    sizeBytes: buffer.length,
  };
};

/**
 * Remove an upload that was never attached to a project, so an abandoned
 * upload does not stay in ImageKit forever. Attached documents are refused:
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
    await deleteStoredFile({ fileId: target.fileId, key: target.key });
  } catch (error) {
    // ImageKit rejects with a plain object, not an Error, so read `message` from
    // either shape instead of stringifying it to "[object Object]".
    const record = error as
      | { message?: unknown; statusCode?: unknown }
      | null
      | undefined;
    logger.error(
      {
        fileId: target.fileId,
        statusCode:
          typeof record?.statusCode === "number"
            ? record.statusCode
            : undefined,
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

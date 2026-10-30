// lib/uploads.ts
import { CLOUDINARY_RES_DOMAIN } from "../storage/cloudinary.storage.js";
import { AppError, ERROR_CODES } from "./errors.js";

/**
 * Result the browser returns after a direct-to-Cloudinary signed upload.
 * The backend never sees the file bytes; it only accepts the metadata
 * Cloudinary returned for an upload we signed.
 */
export type SignedUploadResult = {
  /** Cloudinary `secure_url`. */
  url: string;
  /** Cloudinary `public_id`, always inside this project's `portfolio/` prefix. */
  publicId: string;
};

const PORTFOLIO_PREFIX = "portfolio/";

/**
 * Validate the `{ url, publicId }` pair the admin forwards after a signed
 * upload. Both values are client-supplied, so they are checked against the
 * configured Cloudinary delivery host and the portfolio prefix before they are
 * ever written to the database.
 */
export const validateSignedUpload = (input: unknown): SignedUploadResult => {
  if (typeof input !== "object" || input === null) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      "Upload result must be a JSON object.",
    );
  }

  const record = input as Record<string, unknown>;
  if (typeof record.url !== "string" || record.url.trim() === "") {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      "Upload result is missing url.",
    );
  }
  if (typeof record.publicId !== "string" || record.publicId.trim() === "") {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      "Upload result is missing publicId.",
    );
  }

  const url = record.url.trim();
  const publicId = record.publicId.trim();

  if (!publicId.startsWith(PORTFOLIO_PREFIX) || publicId.includes("..")) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      "Upload publicId must start with portfolio/.",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      "Upload url is not a valid URL.",
    );
  }

  if (parsed.protocol !== "https:" || parsed.hostname !== CLOUDINARY_RES_DOMAIN) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      "Upload url must be an https URL from the Cloudinary delivery host.",
    );
  }

  return { url, publicId };
};

/** The storage key is the Cloudinary public_id for the driver we use now. */
export const storageKeyFromPublicId = (publicId: string): string =>
  publicId.startsWith("/") ? publicId.slice(1) : publicId;

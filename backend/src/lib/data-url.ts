import { AppError, ERROR_CODES } from "./errors.js";

export type DataUrlOptions = {
  allowedMimeTypes: readonly string[];
  maxBytes: number;
  /** Used in the error messages, e.g. "The document". */
  label: string;
};

export type ParsedDataUrl = {
  mimeType: string;
  buffer: Buffer;
};

/**
 * `data:<type>[;param=value];base64,<payload>`. Only base64 data URLs are
 * accepted: a percent-encoded one would need different decoding and is never
 * produced by the admin client.
 */
const DATA_URL_PATTERN =
  /^data:([a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+)(?:;[a-z0-9=.+-]+)*;base64,([A-Za-z0-9+/]+={0,2})$/i;

const megabytes = (bytes: number): string => {
  const value = bytes / (1024 * 1024);
  return Number.isInteger(value) ? `${value} MB` : `${value.toFixed(1)} MB`;
};

/**
 * Decode a base64 data URL without trusting its declared size. The decoded
 * length is checked against `maxBytes` before the Buffer is materialised, so an
 * oversized payload is rejected with a 413 that names the limit instead of
 * reaching the storage provider.
 */
export const parseDataUrl = (
  value: unknown,
  options: DataUrlOptions,
): ParsedDataUrl => {
  const invalid = (): AppError =>
    new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      `${options.label} must be a base64 data URL (data:<type>;base64,<data>).`,
    );

  if (typeof value !== "string" || value.trim() === "") throw invalid();

  const match = DATA_URL_PATTERN.exec(value.trim());
  const mimeType = match?.[1]?.toLowerCase();
  const payload = match?.[2];
  if (!mimeType || !payload) throw invalid();

  if (!options.allowedMimeTypes.includes(mimeType)) {
    throw new AppError(
      415,
      ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
      `${options.label} must be one of: ${options.allowedMimeTypes.join(", ")}.`,
    );
  }

  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  const sizeBytes = Math.floor((payload.length * 3) / 4) - padding;

  if (sizeBytes > options.maxBytes) {
    throw new AppError(
      413,
      ERROR_CODES.PAYLOAD_TOO_LARGE,
      `${options.label} must be ${megabytes(options.maxBytes)} or smaller.`,
    );
  }

  const buffer = Buffer.from(payload, "base64");
  if (buffer.length === 0) throw invalid();

  return { mimeType, buffer };
};

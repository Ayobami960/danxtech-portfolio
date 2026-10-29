import { AppError, ERROR_CODES } from "../lib/errors.js";

const PDF_MAGIC = Buffer.from("%PDF-", "latin1");
const MAX_NAME_IN_MESSAGE = 120;

const describe = (fileName: string | undefined): string => {
  const name = fileName?.trim() ?? "";
  return name === ""
    ? "The uploaded file"
    : `"${name.slice(0, MAX_NAME_IN_MESSAGE)}"`;
};

/** Reject anything that is not a PDF, regardless of extension or MIME type. */
export const assertPdf = (
  buffer: Buffer,
  fileName?: string,
  /** Subject of the second sentence, e.g. "The resume" (default) or "The document". */
  subject = "The resume",
): void => {
  if (buffer.length < 5 || !buffer.subarray(0, 5).equals(PDF_MAGIC)) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      `${describe(fileName)} is not a PDF. ${subject} must be a valid PDF file.`,
    );
  }
};

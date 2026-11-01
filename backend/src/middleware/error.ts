import { randomUUID } from "node:crypto";
import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import multer from "multer";
import { ERROR_CODES } from "../lib/errors.js";
import {
  SAFE_MESSAGES,
  classifyError,
  toErrorBody,
  toFields,
  type ClassifiedError,
} from "../lib/error-response.js";
import { logger } from "../config/logger.js";

/**
 * Library errors whose shape we know and whose text is safe by construction.
 * Anything else goes through `classifyError`, which never echoes the message.
 */
const normalizeLibraryError = (error: unknown): ClassifiedError | null => {
  if (error instanceof ZodError) {
    const fields = toFields(
      error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
    return {
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: SAFE_MESSAGES.VALIDATION_ERROR,
      ...(fields ? { fields } : {}),
    };
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return {
        status: 413,
        code: ERROR_CODES.PAYLOAD_TOO_LARGE,
        message: "The uploaded file is too large.",
      };
    }
    return {
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message:
        error.code === "LIMIT_UNEXPECTED_FILE"
          ? "Unexpected upload field."
          : "The upload could not be processed.",
    };
  }

  const bodyParserType = (error as { type?: unknown } | null)?.type;
  if (bodyParserType === "entity.too.large") {
    return {
      status: 413,
      code: ERROR_CODES.PAYLOAD_TOO_LARGE,
      message: "Request body is too large.",
    };
  }
  if (bodyParserType === "entity.parse.failed") {
    return {
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Request body is not valid JSON.",
    };
  }

  return null;
};

/**
 * The single place that formats error responses. The body never contains SQL,
 * params, table/column names, stacks, driver text, file paths or config values,
 * regardless of NODE_ENV. Full detail is logged server-side under the same
 * request id that the client receives.
 */
export const errorHandler: ErrorRequestHandler = (
  error,
  request,
  response,
  next,
) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  const requestId =
    typeof request.id === "string" && request.id !== ""
      ? request.id
      : randomUUID();

  const classified = normalizeLibraryError(error) ?? classifyError(error);

  logger[classified.status >= 500 ? "error" : "warn"](
    {
      err: error,
      requestId,
      method: request.method,
      url: request.originalUrl,
      status: classified.status,
      code: classified.code,
      userId: request.admin?.id,
    },
    classified.status >= 500 ? "Request failed" : "Request rejected",
  );

  response.setHeader("x-request-id", requestId);
  if (classified.retryAfterSeconds !== undefined) {
    response.setHeader("retry-after", String(classified.retryAfterSeconds));
  }

  response.status(classified.status).json(toErrorBody(classified, requestId));
};

import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import multer from "multer";
import { AppError, ERROR_CODES, type ErrorCode } from "../lib/errors.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

type NormalizedError = {
  status: number;
  code: ErrorCode;
  message: string;
  details?: unknown;
  unexpected?: boolean;
};

type PostgresError = {
  code: string;
  constraint?: string;
  detail?: string;
};

const isPostgresError = (error: unknown): error is PostgresError =>
  typeof error === "object" &&
  error !== null &&
  typeof (error as { code?: unknown }).code === "string";

const normalize = (error: unknown): NormalizedError => {
  if (error instanceof AppError) {
    return {
      status: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof ZodError) {
    return {
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Request validation failed.",
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
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
      details: { field: error.field },
    };
  }

  if (isPostgresError(error)) {
    switch (error.code) {
      case "23505":
        return {
          status: 409,
          code: ERROR_CODES.CONFLICT,
          message: "A record with that value already exists.",
          details: { constraint: error.constraint },
        };
      case "23503":
        return {
          status: 409,
          code: ERROR_CODES.CONFLICT,
          message: "The record is referenced by other data.",
          details: { constraint: error.constraint },
        };
      case "23514":
        return {
          status: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
          message: "A value violates a database constraint.",
          details: { constraint: error.constraint },
        };
      case "22P02":
        return {
          status: 400,
          code: ERROR_CODES.VALIDATION_ERROR,
          message: "A value in the request has an invalid format.",
        };
      default:
        break;
    }
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

  return {
    status: 500,
    code: ERROR_CODES.INTERNAL_ERROR,
    message: env.isProduction
      ? "An unexpected error occurred."
      : error instanceof Error
        ? error.message
        : "An unexpected error occurred.",
    unexpected: true,
  };
};

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

  const normalized = normalize(error);
  const logPayload = {
    err: error,
    requestId: request.id,
    method: request.method,
    url: request.originalUrl,
    status: normalized.status,
  };

  if (normalized.status >= 500) {
    logger.error(logPayload, "Request failed");
  } else {
    logger.warn(logPayload, "Request rejected");
  }

  const envelope: {
    error: { code: ErrorCode; message: string; details?: unknown };
  } = {
    error: {
      code: normalized.code,
      message: normalized.message,
      ...(normalized.details === undefined
        ? {}
        : { details: normalized.details }),
    },
  };

  response.status(normalized.status).json(envelope);
};

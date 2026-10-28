export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE",
  CSRF_INVALID: "CSRF_INVALID",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  DUPLICATE_MESSAGE: "DUPLICATE_MESSAGE",
  INVITE_INVALID: "INVITE_INVALID",
  CHAT_CLOSED: "CHAT_CLOSED",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, ERROR_CODES.VALIDATION_ERROR, message, details);

export const unauthorized = (message = "Authentication required.") =>
  new AppError(401, ERROR_CODES.UNAUTHORIZED, message);

export const forbidden = (message = "You are not allowed to do that.") =>
  new AppError(403, ERROR_CODES.FORBIDDEN, message);

export const notFound = (message = "Resource not found.") =>
  new AppError(404, ERROR_CODES.NOT_FOUND, message);

export const conflict = (message: string, details?: unknown) =>
  new AppError(409, ERROR_CODES.CONFLICT, message, details);

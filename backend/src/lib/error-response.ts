import type { ErrorCode } from "./errors.js";

/**
 * The only client-facing error copy in the backend. Every response and every
 * Socket.IO payload is built from this map, so no ORM, driver, stack-trace or
 * request detail can ever reach a browser.
 */
export const SAFE_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: "Some of the details you entered are not valid.",
  UNAUTHORIZED: "Not signed in.",
  FORBIDDEN: "Not allowed.",
  NOT_FOUND: "Not found.",
  CONFLICT: "That change conflicts with existing data.",
  RATE_LIMITED: "Too many requests. Please try again later.",
  PAYLOAD_TOO_LARGE: "That request is too large.",
  UNSUPPORTED_MEDIA_TYPE: "That file type is not supported.",
  CSRF_INVALID: "Your session could not be verified. Please try again.",
  TWO_FACTOR_CHALLENGE_INVALID:
    "This sign-in challenge has expired. Sign in again.",
  INTERNAL_ERROR: "Something went wrong. Please try again.",
  SERVICE_UNAVAILABLE:
    "The service is temporarily unavailable. Please try again.",
  DUPLICATE_MESSAGE: "That message was already sent.",
  INVITE_INVALID: "That invite link is not valid.",
  CHAT_CLOSED: "This conversation is closed.",
};

export type ClassifiedError = {
  status: number;
  code: ErrorCode;
  message: string;
  fields?: Record<string, string>;
  retryAfterSeconds?: number;
};

export type PublicErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
    fields?: Record<string, string>;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/* ------------------------------ field extraction ----------------------------- */

/** Turn zod-style issues or a `{ field: message }` map into safe field errors. */
export const toFields = (details: unknown): Record<string, string> | undefined => {
  if (Array.isArray(details)) {
    const fields: Record<string, string> = {};
    for (const item of details) {
      if (!isRecord(item)) continue;
      const path = Array.isArray(item.path)
        ? item.path.join(".")
        : typeof item.path === "string"
          ? item.path
          : "";
      const message = typeof item.message === "string" ? item.message : "";
      if (message && !fields[path || "form"]) {
        fields[path || "form"] = message;
      }
    }
    return Object.keys(fields).length > 0 ? fields : undefined;
  }

  if (isRecord(details)) {
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(details)) {
      if (typeof value === "string") fields[key] = value;
    }
    return Object.keys(fields).length > 0 ? fields : undefined;
  }

  return undefined;
};

/* ------------------------------ outage detection ----------------------------- */

/** Socket/network level codes that mean "the database is not reachable". */
const OUTAGE_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_SOCKET",
  "UND_ERR_CLOSED",
  // Postgres: admin shutdown, crash shutdown, cannot connect now.
  "57P01",
  "57P02",
  "57P03",
  // Postgres: too many connections for the role.
  "53300",
]);

/** Postgres SQLSTATE class 08 = connection exception. */
const CONNECTION_CLASS = /^08[0-9A-Z]{3}$/;

const OUTAGE_MESSAGE =
  /(ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EHOSTUNREACH|ENETUNREACH|terminating connection|connection terminated|connection timeout|timeout exceeded when trying to connect|the database system is starting up|cannot connect now|socket hang up|pool is closed|connection pool (?:closed|ended)|WebSocket (?:connection )?(?:failed|closed))/i;

/**
 * True when the failure (or any error in its `cause` chain) means the database
 * or its transport is unavailable. Drizzle wraps driver errors, so the cause
 * chain is always inspected.
 */
export const isServiceUnavailable = (error: unknown): boolean => {
  let current: unknown = error;

  for (let depth = 0; depth < 6; depth += 1) {
    if (current === undefined || current === null) return false;

    if (typeof current === "string") return OUTAGE_MESSAGE.test(current);
    if (!isRecord(current)) return false;

    const code = typeof current.code === "string" ? current.code : undefined;
    if (code && (OUTAGE_CODES.has(code) || CONNECTION_CLASS.test(code))) {
      return true;
    }

    const message =
      typeof current.message === "string" ? current.message : undefined;
    if (message && OUTAGE_MESSAGE.test(message)) return true;

    current = current.cause;
  }

  return false;
};

/* -------------------------------- classification ------------------------------ */

type AppErrorShape = {
  status: number;
  code: ErrorCode;
  message: string;
  details: unknown;
};

/** `AppError` sets `name`; structural matching keeps this module dependency-free. */
const asAppError = (error: unknown): AppErrorShape | null => {
  if (!isRecord(error) || error.name !== "AppError") return null;
  if (typeof error.statusCode !== "number") return null;
  if (typeof error.code !== "string") return null;
  if (!Object.hasOwn(SAFE_MESSAGES, error.code)) return null;
  return {
    status: error.statusCode,
    code: error.code as ErrorCode,
    message: typeof error.message === "string" ? error.message : "",
    details: error.details,
  };
};

const internalError = (): ClassifiedError => ({
  status: 500,
  code: "INTERNAL_ERROR",
  message: SAFE_MESSAGES.INTERNAL_ERROR,
});

const unavailable = (): ClassifiedError => ({
  status: 503,
  code: "SERVICE_UNAVAILABLE",
  message: SAFE_MESSAGES.SERVICE_UNAVAILABLE,
  retryAfterSeconds: 5,
});

/**
 * Map any thrown value to a whitelisted client-facing response.
 *
 * - `AppError` values are authored by this server; their 4xx messages are kept
 *   (except auth/not-found codes, which get fixed generic copy) so validation
 *   and business-rule feedback still works. Their 5xx bodies are replaced.
 * - Database outages become 503, everything else becomes a generic 500.
 */
export const classifyError = (error: unknown): ClassifiedError => {
  const appError = asAppError(error);

  if (appError) {
    const { code } = appError;
    const status =
      appError.status >= 400 && appError.status <= 599
        ? appError.status
        : 500;

    if (code === "SERVICE_UNAVAILABLE") return unavailable();
    if (status >= 500) return { ...internalError(), status };

    if (
      code === "UNAUTHORIZED" ||
      code === "FORBIDDEN" ||
      code === "CSRF_INVALID" ||
      code === "TWO_FACTOR_CHALLENGE_INVALID" ||
      code === "NOT_FOUND" ||
      code === "INVITE_INVALID"
    ) {
      return { status, code, message: SAFE_MESSAGES[code] };
    }

    if (code === "RATE_LIMITED") {
      return {
        status,
        code,
        message: appError.message || SAFE_MESSAGES[code],
        retryAfterSeconds: 60,
      };
    }

    const fields = toFields(appError.details);
    const message = appError.message || SAFE_MESSAGES[code];
    return {
      status,
      code,
      message,
      // Field-level validation feedback stays helpful. A rule that is not tied
      // to one field (password policy, wrong current password) travels as the
      // "form" field so the client can render it from `fields`.
      ...(fields
        ? { fields }
        : code === "VALIDATION_ERROR"
          ? { fields: { form: message } }
          : {}),
    };
  }

  if (isServiceUnavailable(error)) return unavailable();

  return internalError();
};

/* --------------------------------- shaping ----------------------------------- */

export const toErrorBody = (
  classified: ClassifiedError,
  requestId: string,
): PublicErrorBody => ({
  error: {
    code: classified.code,
    message: classified.message,
    requestId,
    ...(classified.fields ? { fields: classified.fields } : {}),
  },
});

/**
 * Socket.IO error text. Acks and error events only ever carry whitelisted copy:
 * a thrown AppError message is never forwarded, even when it looks friendly.
 */
export const toSocketError = (
  error: unknown,
): { code: string; message: string } => {
  const classified = classifyError(error);
  return { code: classified.code, message: SAFE_MESSAGES[classified.code] };
};

export const isOutageError = isServiceUnavailable;

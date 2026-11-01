export type ApiErrorStatus = number | "FETCH_ERROR" | "TIMEOUT";

export type ApiError = {
  status: ApiErrorStatus;
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
  /** Server-side reference logged with the full error; safe to display. */
  requestId?: string;
};

/**
 * All user-facing error copy lives here. The server's message is never shown:
 * it is mapped by `code`/HTTP status, so a driver message that slipped through
 * any layer still cannot reach the screen.
 */
export const FRIENDLY = {
  offline: "You appear to be offline. Check your connection and try again.",
  /** Online, but the request never reached the API (CSP, CORS or DNS). */
  blocked:
    "Your browser could not reach the API. If your connection is fine, a Content-Security-Policy or CORS setting is probably blocking this origin.",
  unavailable: "The service is temporarily unavailable. Please try again shortly.",
  server: "Something went wrong on our side. Please try again.",
  session: "Your session has expired. Please sign in again.",
  permission: "You do not have permission to do that.",
  notFound: "We could not find what you were looking for.",
  rateLimited: "Too many requests. Please wait a moment and try again.",
  conflict: "That change conflicts with existing data. Refresh and try again.",
  validation: "Some of the details you entered need fixing.",
  tooLarge: "That file is too large.",
  unsupportedFile: "That file type is not supported.",
  timeout: "The request took too long. Please try again.",
  generic: "Something went wrong.",
} as const;

/**
 * Defence in depth: anything resembling SQL, a driver error, a stack trace or a
 * file path is discarded even if a server somewhere still forwards it.
 */
const INTERNAL_TEXT_PATTERNS: RegExp[] = [
  /\bselect\b[\s\S]*\bfrom\b/i,
  /\bfrom\s+"/i,
  /\bparams:/i,
  /failed query/i,
  /password_hash|totp_secret|totpsecret/i,
  /econn(refused|reset)/i,
  /\betimedout\b/i,
  /\bstack\b/i,
  /\bdrizzle\b/i,
  /\bpg_?pool\b/i,
  /node_modules/i,
  /syntax error at or near/i,
  /violates .*constraint/i,
  /duplicate key value/i,
  /"public"\./i,
  /\bat .+:\d+:\d+/,
];

export const looksLikeInternalError = (text: string): boolean =>
  INTERNAL_TEXT_PATTERNS.some((pattern) => pattern.test(text));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const safeFieldMessage = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" && !looksLikeInternalError(value)
    ? value
    : undefined;

const toFieldErrors = (details: unknown): Record<string, string> | undefined => {
  if (Array.isArray(details)) {
    const result: Record<string, string> = {};
    for (const detail of details) {
      if (!isRecord(detail)) continue;
      const path = typeof detail.path === "string" ? detail.path : null;
      const message = safeFieldMessage(detail.message);
      if (path && message && !result[path]) result[path] = message;
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  if (isRecord(details)) {
    const result: Record<string, string> = {};
    for (const [path, value] of Object.entries(details)) {
      const message = safeFieldMessage(value);
      if (message && !result[path]) result[path] = message;
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  return undefined;
};

const firstFieldMessage = (
  fieldErrors: Record<string, string> | undefined,
): string | undefined => {
  if (!fieldErrors) return undefined;
  for (const value of Object.values(fieldErrors)) {
    const message = safeFieldMessage(value);
    if (message) return message;
  }
  return undefined;
};

/**
 * `fetch` rejects identically for an offline browser, a blocked origin and an
 * unreachable host. The browser's online flag is the only signal available, so
 * an online failure is labelled as blocked (CSP/CORS) rather than offline.
 */
export const networkFailure = (online: boolean): ApiError => ({
  status: "FETCH_ERROR",
  code: online ? "NETWORK_BLOCKED" : "NETWORK",
  message: online ? FRIENDLY.blocked : FRIENDLY.offline,
});

const defaultCode = (status: ApiErrorStatus): string => {
  if (status === "FETCH_ERROR") return "NETWORK";
  if (status === "TIMEOUT") return "TIMEOUT";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 429) return "RATE_LIMITED";
  if (status === 503) return "SERVICE_UNAVAILABLE";
  if (typeof status === "number" && status >= 500) return "INTERNAL_ERROR";
  return "ERROR";
};

/** Local copy for a status/code pair. Never reads a server message. */
const friendlyMessage = (
  status: ApiErrorStatus,
  code: string,
  fieldErrors?: Record<string, string>,
): string => {
  if (code === "NETWORK_BLOCKED") return FRIENDLY.blocked;
  if (status === "FETCH_ERROR" || code === "NETWORK" || code === "OFFLINE") {
    return FRIENDLY.offline;
  }
  if (status === "TIMEOUT" || code === "TIMEOUT") return FRIENDLY.timeout;
  if (status === 503 || code === "SERVICE_UNAVAILABLE") return FRIENDLY.unavailable;
  if (code === "RATE_LIMITED" || status === 429) return FRIENDLY.rateLimited;
  if (code === "UNAUTHORIZED" || status === 401) return FRIENDLY.session;
  if (code === "FORBIDDEN" || code === "CSRF_INVALID" || status === 403) {
    return FRIENDLY.permission;
  }
  if (code === "NOT_FOUND" || status === 404) return FRIENDLY.notFound;
  if (code === "PAYLOAD_TOO_LARGE" || status === 413) return FRIENDLY.tooLarge;
  if (code === "UNSUPPORTED_MEDIA_TYPE" || status === 415) {
    return FRIENDLY.unsupportedFile;
  }
  if (code === "CONFLICT" || code === "DUPLICATE_MESSAGE" || status === 409) {
    return FRIENDLY.conflict;
  }
  if (code === "VALIDATION_ERROR" || status === 400 || status === 422) {
    return firstFieldMessage(fieldErrors) ?? FRIENDLY.validation;
  }
  if (typeof status === "number" && status >= 500) return FRIENDLY.server;
  return FRIENDLY.generic;
};

export const normalizeError = (
  status: ApiErrorStatus,
  payload: unknown,
): ApiError => {
  const envelope =
    isRecord(payload) && isRecord(payload.error) ? payload.error : null;

  const code =
    typeof envelope?.code === "string" ? envelope.code : defaultCode(status);
  const fieldErrors =
    toFieldErrors(envelope?.fields) ?? toFieldErrors(envelope?.details);
  const requestId =
    typeof envelope?.requestId === "string" && envelope.requestId !== ""
      ? envelope.requestId
      : undefined;

  return {
    status,
    code,
    message: friendlyMessage(status, code, fieldErrors),
    ...(fieldErrors ? { fieldErrors } : {}),
    ...(requestId ? { requestId } : {}),
  };
};

export const isApiError = (value: unknown): value is ApiError =>
  isRecord(value) &&
  typeof value.message === "string" &&
  typeof value.code === "string" &&
  "status" in value;

const normalizeStatus = (value: unknown): ApiErrorStatus | null => {
  if (value === "FETCH_ERROR" || value === "TIMEOUT") return value;
  if (typeof value === "number") return value;
  return null;
};

/** Accepts our `ApiError`, an RTK Query error, or a rejected thunk value. */
const toApiError = (error: unknown): ApiError | null => {
  if (isApiError(error)) return error;
  if (!isRecord(error) || !("status" in error)) return null;
  const status = normalizeStatus(error.status);
  if (status === null) return null;
  return normalizeError(status, "data" in error ? error.data : error);
};

export const getFieldErrors = (error: unknown): Record<string, string> => {
  const api = toApiError(error);
  if (api) return api.fieldErrors ?? {};
  if (isRecord(error) && isRecord(error.data)) {
    return normalizeError(500, error.data).fieldErrors ?? {};
  }
  return {};
};

/**
 * Safe text for toasts, forms and dialogs. Server text is ignored; unknown
 * values fall back to the caller's contextual copy.
 */
export const errorMessage = (
  error: unknown,
  fallback: string = FRIENDLY.generic,
): string => {
  const api = toApiError(error);
  if (api) return friendlyMessage(api.status, api.code, api.fieldErrors);

  // Plain `Error`s are thrown by client-side helpers (uploads); those messages
  // are local, but are still discarded if they look internal.
  if (error instanceof Error && error.message) {
    return looksLikeInternalError(error.message) ? fallback : error.message;
  }
  if (isRecord(error) && typeof error.message === "string" && error.message) {
    return looksLikeInternalError(error.message) ? fallback : error.message;
  }
  return fallback;
};

export type ErrorDetails = {
  title: string;
  message: string;
  requestId?: string;
};

/** Everything `ErrorState` needs: a friendly title, copy and a log reference. */
export const errorDetails = (
  error: unknown,
  fallback: string = "The API did not respond as expected.",
): ErrorDetails => {
  const api = toApiError(error);
  const status = api?.status;
  const code = api?.code ?? "";

  const blocked = code === "NETWORK_BLOCKED";
  const offline = !blocked && (status === "FETCH_ERROR" || code === "NETWORK");
  const unavailable = status === 503 || code === "SERVICE_UNAVAILABLE";
  const serverError = typeof status === "number" && status >= 500;

  const title = blocked
    ? "Can't reach the API"
    : offline
      ? "You're offline"
      : unavailable
        ? "Service temporarily unavailable"
        : serverError
          ? "Something went wrong on our side"
          : "Could not load this view";

  const message = api
    ? friendlyMessage(api.status, api.code, api.fieldErrors)
    : errorMessage(error, fallback);

  return {
    title,
    message,
    ...(api?.requestId ? { requestId: api.requestId } : {}),
  };
};

/** Network failures and 5xx are transient: never treat them as signed out. */
export const isTransientError = (error: unknown): boolean => {
  const api = toApiError(error);
  if (!api) return false;
  return (
    api.status === "FETCH_ERROR" ||
    api.status === "TIMEOUT" ||
    api.code === "SERVICE_UNAVAILABLE" ||
    (typeof api.status === "number" && api.status >= 500)
  );
};

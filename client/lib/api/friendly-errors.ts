/**
 * Client-side error copy for the public site.
 *
 * The server never sends driver/ORM text any more, but the browser must not
 * depend on that: every message rendered here is local copy selected by error
 * code and HTTP status, and anything that still looks like SQL, a stack trace
 * or a file path is discarded.
 */

export type FriendlyStatus = number | "FETCH_ERROR" | "TIMEOUT";

export const FRIENDLY = {
  offline: "You appear to be offline. Check your connection and try again.",
  unavailable: "The service is temporarily unavailable. Please try again shortly.",
  server: "Something went wrong on our side. Please try again.",
  session: "Your session has expired. Please start again.",
  permission: "You do not have permission to do that.",
  notFound: "We could not find what you were looking for.",
  rateLimited: "Too many requests. Please wait a moment and try again.",
  conflict: "That change conflicts with existing data. Refresh and try again.",
  validation: "Some of the details you entered need fixing.",
  tooLarge: "That file is too large.",
  unsupportedFile: "That file type is not supported.",
  timeout: "The request took too long. Please try again.",
  generic: "Something went wrong. Please try again.",
} as const;

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

/**
 * Field errors arrive as `{ field: message }` (current API) or as the legacy
 * `[{ path, message }]` list. Both are filtered before display.
 */
export const safeFieldErrors = (
  value: unknown,
): Record<string, string> | undefined => {
  if (Array.isArray(value)) {
    const result: Record<string, string> = {};
    for (const entry of value) {
      if (!isRecord(entry)) continue;
      const path = typeof entry.path === "string" ? entry.path : null;
      const message = safeFieldMessage(entry.message);
      if (path && message && !result[path]) result[path] = message;
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  if (isRecord(value)) {
    const result: Record<string, string> = {};
    for (const [path, message] of Object.entries(value)) {
      const safe = safeFieldMessage(message);
      if (safe && !result[path]) result[path] = safe;
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  return undefined;
};

export const firstFieldMessage = (
  fields: Record<string, string> | undefined,
): string | undefined => {
  if (!fields) return undefined;
  for (const value of Object.values(fields)) {
    const message = safeFieldMessage(value);
    if (message) return message;
  }
  return undefined;
};

/** Local copy for a status/code pair. Never reads a server message. */
export const friendlyMessage = (
  status: FriendlyStatus,
  code: string,
  fields?: Record<string, string>,
): string => {
  if (status === "FETCH_ERROR" || code === "NETWORK" || code === "OFFLINE") {
    return FRIENDLY.offline;
  }
  if (status === "TIMEOUT" || code === "TIMEOUT") return FRIENDLY.timeout;
  if (status === 503 || code === "SERVICE_UNAVAILABLE") return FRIENDLY.unavailable;
  if (code === "RATE_LIMITED" || status === 429) return FRIENDLY.rateLimited;
  if (code === "UNAUTHORIZED" || code === "INVITE_INVALID" || status === 401) {
    return FRIENDLY.session;
  }
  if (code === "FORBIDDEN" || code === "CSRF_INVALID" || status === 403) {
    return FRIENDLY.permission;
  }
  if (code === "NOT_FOUND" || status === 404) return FRIENDLY.notFound;
  if (code === "PAYLOAD_TOO_LARGE" || status === 413) return FRIENDLY.tooLarge;
  if (code === "UNSUPPORTED_MEDIA_TYPE" || status === 415) {
    return FRIENDLY.unsupportedFile;
  }
  if (
    code === "CONFLICT" ||
    code === "DUPLICATE_MESSAGE" ||
    code === "CHAT_CLOSED" ||
    status === 409
  ) {
    return FRIENDLY.conflict;
  }
  if (code === "VALIDATION_ERROR" || status === 400 || status === 422) {
    return firstFieldMessage(fields) ?? FRIENDLY.validation;
  }
  if (typeof status === "number" && status >= 500) return FRIENDLY.server;
  return FRIENDLY.generic;
};

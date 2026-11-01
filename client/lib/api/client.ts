import type { ApiErrorBody } from "./types";
import {
  FRIENDLY,
  friendlyMessage,
  looksLikeInternalError,
  safeFieldErrors,
  type FriendlyStatus,
} from "./friendly-errors";

/** Local development API; never used by a production build. */
const LOCAL_API = "http://localhost:8000";

/**
 * Base origin of the Express API, without a trailing slash.
 *
 * Server Components read `API_URL` (never shipped to the browser) and fall back
 * to the public value; browser code only ever sees `NEXT_PUBLIC_API_URL`.
 *
 * A production build has no localhost fallback: pointing a deployed site at
 * http://localhost silently breaks every API path (including the resume link),
 * so a missing variable fails loudly instead.
 */
const resolveBaseUrl = (): string => {
  const configured =
    typeof window === "undefined"
      ? process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL
      : process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "The API base URL is not configured. Set API_URL and NEXT_PUBLIC_API_URL in the hosting environment, then redeploy.",
    );
  }
  return LOCAL_API;
};

export const API_BASE_URL = resolveBaseUrl();

/** The API is mounted at this prefix (`API_PREFIX` in the backend). */
export const API_PREFIX = "/api/v1";

/** Public SSE stream for content updates (outside the versioned prefix). */
export const contentEventsUrl = (): string => `${API_BASE_URL}/api/events`;

/** Version probe used when SSE is unavailable or has dropped. */
export const contentVersionUrl = (): string =>
  `${API_BASE_URL}/api/content-version`;

/**
 * Route to the resume stream; the client must build it from the API origin.
 * `version` (the resume's updatedAt) busts the PDF cache after a replacement.
 */
export const resumeDownloadUrl = (
  version?: string,
  inline = false,
): string => {
  const query = new URLSearchParams();
  if (version) query.set("v", version);
  if (inline) query.set("inline", "1");
  const suffix = query.toString();
  return `${API_BASE_URL}${API_PREFIX}/resume/download${suffix ? `?${suffix}` : ""}`;
};

/** A normalized failure from the API (network failures get status 0). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly fields?: Record<string, string>;
  readonly details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    options: {
      requestId?: string;
      fields?: Record<string, string>;
      details?: unknown;
    } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    if (options.requestId) this.requestId = options.requestId;
    if (options.fields) this.fields = options.fields;
    if (options.details !== undefined) this.details = options.details;
  }
}

export const isApiError = (value: unknown): value is ApiError =>
  value instanceof ApiError;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isErrorBody = (value: unknown): value is ApiErrorBody =>
  isRecord(value) &&
  isRecord(value.error) &&
  typeof value.error.code === "string";

/**
 * Build a safe error from an HTTP response. The server's `message` is ignored:
 * copy is chosen locally from the code and status.
 */
const fromResponse = (status: number, payload: unknown): ApiError => {
  if (isErrorBody(payload)) {
    const { code, requestId, details } = payload.error;
    const fields =
      safeFieldErrors(payload.error.fields) ?? safeFieldErrors(details);
    return new ApiError(status, code, friendlyMessage(status, code, fields), {
      ...(requestId ? { requestId } : {}),
      ...(fields ? { fields } : {}),
      ...(details !== undefined ? { details } : {}),
    });
  }

  const code =
    status === 401
      ? "UNAUTHORIZED"
      : status === 404
        ? "NOT_FOUND"
        : status === 429
          ? "RATE_LIMITED"
          : status === 503
            ? "SERVICE_UNAVAILABLE"
            : status >= 500
              ? "INTERNAL_ERROR"
              : "ERROR";
  return new ApiError(status, code, friendlyMessage(status, code));
};

const toApiError = async (response: Response): Promise<ApiError> => {
  const payload: unknown = await response.json().catch(() => null);
  return fromResponse(response.status, payload);
};

export type ApiRequestOptions = {
  /** Cache tags this request participates in (backend REVALIDATE_TAGS). */
  tags?: string[];
  /** Seconds before Next re-fetches; ignored when `noStore` is set. */
  revalidate?: number;
  /** For always-fresh data such as resume availability. */
  noStore?: boolean;
  timeoutMs?: number;
};

const TIMEOUT_MS = 8_000;

const request = async (
  path: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> => {
  try {
    return await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";
    throw new ApiError(
      0,
      timedOut ? "TIMEOUT" : "NETWORK",
      timedOut
        ? FRIENDLY.timeout
        : FRIENDLY.offline,
    );
  }
};

/** GET a public endpoint. Throws `ApiError` for any non-2xx response. */
export const apiGet = async <T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> => {
  const response = await request(
    path,
    {
      method: "GET",
      headers: { accept: "application/json" },
      ...(options.noStore
        ? { cache: "no-store" as const }
        : {
            next: {
              tags: options.tags,
              revalidate: options.revalidate ?? 60,
            },
          }),
    },
    options.timeoutMs ?? TIMEOUT_MS,
  );

  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
};

/** POST JSON from the browser (contact form). Throws `ApiError` on failure. */
export const apiPost = async <T>(
  path: string,
  body: unknown,
  timeoutMs = TIMEOUT_MS,
): Promise<T> => {
  const response = await request(
    path,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );

  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
};

const statusOf = (value: unknown): FriendlyStatus | null => {
  if (value === "FETCH_ERROR" || value === "TIMEOUT") return value;
  if (typeof value === "number") return value;
  return null;
};

/** Accepts an `ApiError`, an RTK Query error or a socket ack error. */
const asApiError = (error: unknown): ApiError | null => {
  if (isApiError(error)) return error;
  if (!isRecord(error)) return null;

  if ("status" in error) {
    const status = statusOf(error.status);
    if (status !== null) {
      return fromResponse(
        typeof status === "number" ? status : status === "TIMEOUT" ? 408 : 0,
        "data" in error ? error.data : null,
      );
    }
  }

  // Socket ack / handshake errors are `{ code, message }` without a status.
  if (typeof error.code === "string") {
    return new ApiError(0, error.code, friendlyMessage(0, error.code));
  }

  return null;
};

/**
 * Safe text for the UI. Server-provided text is never shown: known errors map
 * to local copy, and unknown values fall back to the caller's contextual text.
 */
export const errorMessage = (
  error: unknown,
  fallback: string = FRIENDLY.generic,
): string => {
  const api = asApiError(error);
  if (api) return api.message;

  // Plain `Error`s are built by client-side helpers (uploads); their messages
  // are local, but are still discarded if they look like internal detail.
  if (error instanceof Error && error.message) {
    return looksLikeInternalError(error.message) ? fallback : error.message;
  }
  return fallback;
};

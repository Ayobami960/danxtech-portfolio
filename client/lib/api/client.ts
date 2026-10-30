import type { ApiErrorBody } from "./types";

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
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const isApiError = (value: unknown): value is ApiError =>
  value instanceof ApiError;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isErrorBody = (value: unknown): value is ApiErrorBody =>
  isRecord(value) &&
  isRecord(value.error) &&
  typeof value.error.code === "string" &&
  typeof value.error.message === "string";

const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

const toApiError = async (response: Response): Promise<ApiError> => {
  const payload: unknown = await response.json().catch(() => null);

  if (isErrorBody(payload)) {
    return new ApiError(
      response.status,
      payload.error.code,
      payload.error.message,
      payload.error.details,
    );
  }

  if (response.status === 429) {
    return new ApiError(429, "RATE_LIMITED", "Too many requests. Please try again later.");
  }
  if (response.status >= 500) {
    return new ApiError(response.status, "INTERNAL_ERROR", FALLBACK_MESSAGE);
  }
  return new ApiError(response.status, "ERROR", FALLBACK_MESSAGE);
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
        ? "The server took too long to respond."
        : "The server could not be reached.",
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

/** Safe text for the UI: the API's own message, never a stack trace. */
export const errorMessage = (error: unknown, fallback = FALLBACK_MESSAGE): string => {
  if (isApiError(error)) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

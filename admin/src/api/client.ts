import { logger } from "../lib/logger";
import { API_BASE } from "../utils/config";
import { clearSessionHint } from "../utils/sessionHint";
import { networkFailure, normalizeError, type ApiError } from "./errors";

export type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: ApiError };

export type RefreshResult = { ok: boolean; csrfToken: string | null };

const parseBody = async (response: Response): Promise<unknown> => {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

/* --------------------------------- CSRF ---------------------------------- */

/** Shared cache: every POST reads the same current token. */
let csrfToken: string | null = null;
let csrfInFlight: Promise<string | null> | null = null;

/** Adopt a token the server just returned (login / verify responses). */
export const rememberCsrfToken = (token: unknown): void => {
  if (typeof token === "string" && token !== "") csrfToken = token;
};

const requestCsrfToken = async (): Promise<string | null> => {
  try {
    const response = await fetch(`${API_BASE}/auth/csrf`, {
      credentials: "include",
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { csrfToken?: unknown };
    const token = typeof data.csrfToken === "string" ? data.csrfToken : null;
    if (token) csrfToken = token;
    return token;
  } catch (error) {
    logger.warn("[api] csrf token request failed", error);
    return null;
  }
};

/**
 * One in-flight GET /auth/csrf for the whole app, so parallel mutations share a
 * single token request. `force` after a 403 discards the cached token; it is
 * retried at most once by the callers.
 */
export const fetchCsrfToken = async (
  options: { force?: boolean } = {},
): Promise<string | null> => {
  // Join any in-flight request first: a forced refetch must not reuse the
  // token that just failed, so `force` waits it out and then starts fresh.
  if (csrfInFlight) await csrfInFlight;
  if (!options.force && csrfToken) return csrfToken;

  csrfInFlight = requestCsrfToken().finally(() => {
    csrfInFlight = null;
  });
  return csrfInFlight;
};

export const csrfTokenCache = (): string | null => csrfToken;

/* ------------------------------- requests -------------------------------- */

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  csrfToken?: string | null;
  signal?: AbortSignal;
  /** Used by pagehide handlers so the request survives unload. */
  keepalive?: boolean;
};

export const apiRequest = async <T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> => {
  const isMutation = !!(options.method && options.method !== "GET");

  const send = async (token: string | null): Promise<ApiResult<T>> => {
    const headers: Record<string, string> = { accept: "application/json" };
    if (options.body !== undefined) headers["content-type"] = "application/json";
    if (isMutation && token) headers["x-csrf-token"] = token;

    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: options.method ?? "GET",
        credentials: "include",
        headers,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        ...(options.signal ? { signal: options.signal } : {}),
        ...(options.keepalive ? { keepalive: true } : {}),
      });
      const data = await parseBody(response);
      if (!response.ok) {
        return { ok: false, error: normalizeError(response.status, data) };
      }
      return { ok: true, data: data as T, status: response.status };
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return {
          ok: false,
          error: {
            status: "TIMEOUT",
            code: "TIMEOUT",
            message: "Request cancelled.",
          },
        };
      }

      // No response was received: offline, CSP-blocked, CORS-blocked or the
      // host is down. The throw is the only diagnostic the browser gives us.
      const online =
        typeof navigator === "undefined" || navigator.onLine !== false;
      logger.error("[api] request failed before a response was received", {
        path,
        error,
        browserOnline: online,
      });
      return { ok: false, error: networkFailure(online) };
    }
  };

  // A mutation always starts with a current token; the first one is fetched if
  // the login page has not done it yet.
  let token = isMutation
    ? (options.csrfToken ?? (await fetchCsrfToken()))
    : null;

  let result = await send(token);

  // Stale/revoked token: refresh it once and retry once. Never loop.
  if (
    !result.ok &&
    isMutation &&
    result.error.status === 403 &&
    result.error.code === "CSRF_INVALID"
  ) {
    const fresh = await fetchCsrfToken({ force: true });
    if (fresh) {
      token = fresh;
      result = await send(fresh);
    }
  }

  return result;
};

/* -------------------------------- refresh -------------------------------- */

let refreshInFlight: Promise<RefreshResult> | null = null;

const postRefresh = async (token: string): Promise<Response | null> => {
  try {
    return await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { accept: "application/json", "x-csrf-token": token },
    });
  } catch (error) {
    logger.warn("[api] refresh failed before a response was received", error);
    return null;
  }
};

const performRefresh = async (): Promise<RefreshResult> => {
  let token = await fetchCsrfToken();
  if (!token) return { ok: false, csrfToken: null };

  let response = await postRefresh(token);

  // Same rule as mutations: one forced token refetch, one retry.
  if (response?.status === 403) {
    const fresh = await fetchCsrfToken({ force: true });
    if (!fresh) return { ok: false, csrfToken: null };
    token = fresh;
    response = await postRefresh(fresh);
  }

  if (!response || !response.ok) {
    // Both the access and refresh cookies are dead: drop the hint so the next
    // boot does not repeat this round trip. This is the only place the hint is
    // cleared by a network path.
    clearSessionHint();
    return { ok: false, csrfToken: token };
  }

  const data = (await response.json().catch(() => null)) as {
    csrfToken?: unknown;
  } | null;
  if (typeof data?.csrfToken === "string") token = data.csrfToken;
  return { ok: true, csrfToken: token };
};

/**
 * Exchange the refresh cookie for a new access cookie. Parallel 401s all await
 * the same promise, so one refresh serves the whole burst.
 */
export const refreshSession = (): Promise<RefreshResult> => {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = performRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
};

import { API_BASE } from "../app/config";
import { normalizeError, type ApiError } from "./errors";

export type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: ApiError };

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

export const fetchCsrfToken = async (): Promise<string | null> => {
  try {
    const response = await fetch(`${API_BASE}/auth/csrf`, {
      credentials: "include",
      headers: { accept: "application/json" },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { csrfToken?: unknown };
    return typeof data.csrfToken === "string" ? data.csrfToken : null;
  } catch {
    return null;
  }
};

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  csrfToken?: string | null;
  signal?: AbortSignal;
};

export const apiRequest = async <T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> => {
  const headers: Record<string, string> = { accept: "application/json" };
  if (options.body !== undefined) headers["content-type"] = "application/json";

  const isMutation = !!(options.method && options.method !== "GET");

  // Prefer a token passed by the caller (already current), otherwise for
  // mutations make sure we have a current one before sending.
  let token = options.csrfToken ?? (isMutation ? (await fetchCsrfToken()) : undefined);

  if (isMutation && token) {
    headers["x-csrf-token"] = token;
  }

  const send = async (): Promise<ApiResult<T>> => {
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method: options.method ?? "GET",
        credentials: "include",
        headers,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        ...(options.signal ? { signal: options.signal } : {}),
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
      return { ok: false, error: normalizeError("FETCH_ERROR", null) };
    }
  };

  const result = await send();

  // A 403 CSRF_INVALID means the token we sent was missing, stale, or
  // cleared server-side (logout / password change / 2fa cookie cleared).
  // Fetch a fresh one and retry once; if that also fails, report it.
  if (
    result.ok === false &&
    result.error.status === 403 &&
    result.error.code === "CSRF_INVALID" &&
    isMutation
  ) {
    const fresh = await fetchCsrfToken();
    if (fresh) {
      headers["x-csrf-token"] = fresh;
      const retry = await send();
      if (retry.ok) return retry;
    }
  }

  return result;
};

/** Exchange the refresh cookie for a new access cookie. Returns success. */
export const refreshSession = async (
  csrfToken: string | null,
): Promise<{ ok: boolean; csrfToken: string | null }> => {
  let token = csrfToken ?? (await fetchCsrfToken());
  if (!token) return { ok: false, csrfToken: null };

  const attempt = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    credentials: "include",
    headers: { accept: "application/json", "x-csrf-token": token },
  });

  if (attempt.status === 403) {
    token = await fetchCsrfToken();
    if (!token) return { ok: false, csrfToken: null };
    const retry = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { accept: "application/json", "x-csrf-token": token },
    });
    return { ok: retry.ok, csrfToken: token };
  }

  return { ok: attempt.ok, csrfToken: token };
};

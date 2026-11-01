import {
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { Mutex } from "async-mutex";
import { API_BASE } from "../app/config";
import type { RootState } from "../app/store";
import { normalizeError, type ApiError } from "./errors";
import {
  setCsrfToken,
  sessionExpired,
} from "../features/auth/authSlice";
import { fetchCsrfToken, refreshSession } from "./client";

const mutex = new Mutex();
let lastRefreshedAt = 0;

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE,
  credentials: "include",
  prepareHeaders: async (headers, { getState }) => {
    const state = getState() as RootState;
    headers.set("accept", "application/json");

    const token = state.auth.csrfToken;
    if (token) {
      headers.set("x-csrf-token", token);
      return headers;
    }

    // Redux has no token yet. For GET/HEAD/OPTIONS we can proceed without
    // one (those are never CSRF-protected here). For anything else, grab a
    // current token from the server so the first mutation does not fail.
    const args = (getState() as { api?: { args?: FetchArgs } }).api?.args;
    const method =
      typeof args === "string"
        ? "GET"
        : (args as FetchArgs)?.method;
    const isMutation = !!(method && method !== "GET" && method !== "HEAD");

    if (!isMutation) return headers;

    const fresh = await fetchCsrfToken();
    if (fresh) {
      headers.set("x-csrf-token", fresh);
    }
    return headers;
  },
});

type Api = Parameters<BaseQueryFn<string | FetchArgs, unknown, ApiError>>[1];

/** One shared refresh for however many requests fail at the same moment. */
const refreshOnce = async (api: Api): Promise<boolean> => {
  const release = await mutex.acquire();
  try {
    if (Date.now() - lastRefreshedAt < 2_000) return true;

    const state = api.getState() as RootState;
    const result = await refreshSession(state.auth.csrfToken);
    if (result.csrfToken) api.dispatch(setCsrfToken(result.csrfToken));
    if (result.ok) {
      lastRefreshedAt = Date.now();
      return true;
    }
    return false;
  } finally {
    release();
  }
};

const statusOf = (
  error: FetchBaseQueryError,
): number | "FETCH_ERROR" | "TIMEOUT" => {
  if (typeof error.status === "number") return error.status;
  return error.status === "TIMEOUT_ERROR" ? "TIMEOUT" : "FETCH_ERROR";
};

const normalize = (error: FetchBaseQueryError): ApiError =>
  normalizeError(statusOf(error), error.data);

export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  ApiError
> = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (!result.error) return result;

  const error = normalize(result.error as FetchBaseQueryError);

  // Retry once with a freshly issued token. If the fresh token is also
  // invalid, the request is genuinely forged/malformed and must fail.
  if (error.status === 403 && error.code === "CSRF_INVALID") {
    const token = await fetchCsrfToken();
    if (token) {
      api.dispatch(setCsrfToken(token));
      const retry = await rawBaseQuery(args, api, extraOptions);
      if (!retry.error) return retry;
      const retryError = normalize(retry.error as FetchBaseQueryError);
      if (retryError.status === 403 && retryError.code === "CSRF_INVALID") {
        // Do not recurse again; report the fresh-token failure as a normal
        // ApiError envelope so every return path has the same type.
        return { error: retry.error ? normalize(retry.error as FetchBaseQueryError) : normalizeError("FETCH_ERROR", null) };
      }
      result = retry;
      if (!result.error) return result;
    }
  }

  if (error.status === 401) {
    const refreshed = await refreshOnce(api);
    if (refreshed) {
      result = await rawBaseQuery(args, api, extraOptions);
      if (!result.error) return result;
    }

    const finalError = normalize(result.error as FetchBaseQueryError);
    if (finalError.status === 401) {
      api.dispatch(sessionExpired());
    }
    return { error: finalError };
  }

  return {
    error: normalize(result.error as FetchBaseQueryError),
  };

};

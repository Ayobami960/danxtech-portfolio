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
  prepareHeaders: (headers, { getState }) => {
    const state = getState() as RootState;
    headers.set("accept", "application/json");
    if (state.auth.csrfToken) {
      headers.set("x-csrf-token", state.auth.csrfToken);
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

  if (result.error) {
    const error = normalize(result.error as FetchBaseQueryError);

    if (error.status === 403 && error.code === "CSRF_INVALID") {
      const token = await fetchCsrfToken();
      if (token) {
        api.dispatch(setCsrfToken(token));
        result = await rawBaseQuery(args, api, extraOptions);
      }
    }

    if (result.error && normalize(result.error as FetchBaseQueryError).status === 401) {
      const refreshed = await refreshOnce(api);
      if (refreshed) {
        result = await rawBaseQuery(args, api, extraOptions);
      }
      if (!result.error) return result;

      const finalError = normalize(result.error as FetchBaseQueryError);
      if (finalError.status === 401) {
        api.dispatch(sessionExpired());
      }
      return { error: finalError };
    }

    return {
      error: result.error
        ? normalize(result.error as FetchBaseQueryError)
        : normalizeError("FETCH_ERROR", null),
    };
  }

  return result;
};

import { createAsyncThunk } from "@reduxjs/toolkit";
import type { RootState } from "../../store/store";
import {
  apiRequest,
  fetchCsrfToken,
  rememberCsrfToken,
  refreshSession,
} from "../../api/client";
import { isTransientError, type ApiError } from "../../api/errors";
import type { AdminUser } from "../../api/types";
import { clearSessionHint, hasSessionHint } from "../../utils/sessionHint";
import {
  loggedOut,
  setAnonymous,
  setAuthenticated,
  setAwaitingTwoFactor,
  setCsrfToken,
  setSessionUnavailable,
  twoFactorCancelled,
  updateUser,
} from "./authSlice";

type BootstrapOutcome =
  | { kind: "authenticated"; admin: AdminUser; csrfToken: string | null }
  | { kind: "anonymous"; csrfToken: string | null }
  | { kind: "unavailable"; error: ApiError; csrfToken: string | null };

/**
 * Resolve the session without touching the store; the thunk below applies the
 * outcome. That keeps the network work independent of thunk dispatch typing and
 * makes the single-flight promise easy to share.
 */
const probeSession = async (
  getState: () => RootState,
): Promise<BootstrapOutcome> => {
  // No session hint: nobody has fully authenticated in this browser, so there
  // is nothing to restore. Skip `/auth/me` and `/auth/refresh` entirely — they
  // would only produce expected 401/403 responses in the console.
  if (!hasSessionHint()) return { kind: "anonymous", csrfToken: null };

  let csrf = getState().auth.csrfToken ?? (await fetchCsrfToken());

  let result = await apiRequest<{ admin: AdminUser }>("/auth/me", {
    csrfToken: csrf,
  });

  if (!result.ok && result.error.status === 401) {
    // Exactly one refresh attempt, shared with any parallel 401s.
    const refreshed = await refreshSession();
    if (refreshed.csrfToken) csrf = refreshed.csrfToken;
    if (!refreshed.ok) {
      // client.ts already cleared the hint: the session is genuinely dead.
      return { kind: "anonymous", csrfToken: csrf };
    }
    result = await apiRequest<{ admin: AdminUser }>("/auth/me", {
      csrfToken: csrf,
    });
  }

  if (result.ok) {
    return { kind: "authenticated", admin: result.data.admin, csrfToken: csrf };
  }

  // A database outage, timeout or blocked request is not a sign-out.
  if (isTransientError(result.error)) {
    return { kind: "unavailable", error: result.error, csrfToken: csrf };
  }

  return { kind: "anonymous", csrfToken: csrf };
};

/** One in-flight bootstrap for the whole tab, shared by every caller. */
let bootstrapInFlight: Promise<AdminUser | null> | null = null;

export const bootstrapSession = createAsyncThunk<
  AdminUser | null,
  void,
  { state: RootState }
>(
  "auth/bootstrap",
  async (_arg, { dispatch, getState }) => {
    if (bootstrapInFlight) return bootstrapInFlight;

    const inFlight = probeSession(getState)
      .then((outcome): AdminUser | null => {
        if (outcome.csrfToken) {
          rememberCsrfToken(outcome.csrfToken);
          dispatch(setCsrfToken(outcome.csrfToken));
        }

        switch (outcome.kind) {
          case "authenticated":
            dispatch(setAuthenticated(outcome.admin));
            return outcome.admin;
          case "unavailable":
            dispatch(setSessionUnavailable(outcome.error));
            return null;
          default:
            dispatch(setAnonymous());
            return null;
        }
      })
      .finally(() => {
        bootstrapInFlight = null;
      });

    bootstrapInFlight = inFlight;
    return inFlight;
  },
  {
    // React StrictMode double-invokes the mount effect; the single-flight
    // promise above handles that, and this avoids a pointless re-probe once a
    // session is already established.
    condition: (_arg, { getState }) =>
      (getState() as RootState).auth.status !== "authenticated",
  },
);

export type LoginResult = { requires2fa: boolean };

export const login = createAsyncThunk<
  LoginResult,
  { email: string; password: string },
  { state: RootState; rejectValue: ApiError }
>("auth/login", async (input, { dispatch, getState, rejectWithValue }) => {
  // A mutation always needs a current CSRF token; apiRequest fetches one if the
  // cache is empty, so the first login no longer trips a 403.
  const csrf = getState().auth.csrfToken ?? (await fetchCsrfToken());
  if (csrf) dispatch(setCsrfToken(csrf));

  const result = await apiRequest<
    { admin?: AdminUser; csrfToken?: string } & { requires2fa?: boolean }
  >("/auth/login", { method: "POST", body: input, csrfToken: csrf });

  if (!result.ok) return rejectWithValue(result.error);

  if (result.data.csrfToken) {
    rememberCsrfToken(result.data.csrfToken);
    dispatch(setCsrfToken(result.data.csrfToken));
  }

  if (result.data.requires2fa) {
    // Pending only: the server has not issued tokens and has not set the
    // session hint, so the app must not treat this as signed in.
    dispatch(setAwaitingTwoFactor());
    return { requires2fa: true };
  }

  if (result.data.admin) {
    dispatch(setAuthenticated(result.data.admin));
    return { requires2fa: false };
  }

  return rejectWithValue({
    status: 500,
    code: "ERROR",
    message: "Unexpected login response.",
  });
});

export const verifyTwoFactor = createAsyncThunk<
  void,
  { code: string },
  { state: RootState; rejectValue: ApiError }
>("auth/verify2fa", async (input, { dispatch, getState, rejectWithValue }) => {
  const csrf = getState().auth.csrfToken;
  const result = await apiRequest<{ admin: AdminUser; csrfToken?: string }>(
    "/auth/2fa/verify",
    { method: "POST", body: input, csrfToken: csrf },
  );

  if (!result.ok) return rejectWithValue(result.error);
  if (result.data.csrfToken) {
    rememberCsrfToken(result.data.csrfToken);
    dispatch(setCsrfToken(result.data.csrfToken));
  }
  dispatch(setAuthenticated(result.data.admin));
});

/**
 * Abandon a pending 2FA challenge. Fire-and-forget: the server call is
 * idempotent (204 even when nothing is pending), and the local state is reset
 * even if the request cannot be sent. Never touches a real session.
 */
export const cancelTwoFactor = createAsyncThunk<
  void,
  { keepalive?: boolean } | undefined,
  { state: RootState }
>("auth/cancelTwoFactor", async (arg, { dispatch, getState }) => {
  try {
    await apiRequest("/auth/2fa/cancel", {
      method: "POST",
      csrfToken: getState().auth.csrfToken,
      keepalive: arg?.keepalive === true,
    });
  } finally {
    dispatch(twoFactorCancelled());
  }
});

export const logout = createAsyncThunk<void, void, { state: RootState }>(
  "auth/logout",
  async (_arg, { dispatch, getState }) => {
    try {
      await apiRequest("/auth/logout", {
        method: "POST",
        csrfToken: getState().auth.csrfToken,
      });
    } finally {
      // The server clears it too; this covers an unreachable API.
      clearSessionHint();
      dispatch(loggedOut());
    }
  },
);

export const changePassword = createAsyncThunk<
  void,
  { currentPassword: string; newPassword: string },
  { state: RootState; rejectValue: ApiError }
>(
  "auth/changePassword",
  async (input, { dispatch, getState, rejectWithValue }) => {
    const result = await apiRequest<{ ok: true }>("/auth/password", {
      method: "PATCH",
      body: input,
      csrfToken: getState().auth.csrfToken,
    });
    if (!result.ok) return rejectWithValue(result.error);
    clearSessionHint();
    dispatch(loggedOut());
  },
);

export const refreshCsrf = createAsyncThunk<void, void>(
  "auth/refreshCsrf",
  async (_arg, { dispatch }) => {
    const token = await fetchCsrfToken({ force: true });
    if (token) {
      rememberCsrfToken(token);
      dispatch(setCsrfToken(token));
    }
  },
);

export const setTwoFactorEnabled = createAsyncThunk<void, boolean>(
  "auth/setTwoFactorEnabled",
  async (enabled, { dispatch }) => {
    dispatch(updateUser({ totpEnabled: enabled }));
  },
);

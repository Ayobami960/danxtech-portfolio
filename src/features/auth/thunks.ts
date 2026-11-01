import { createAsyncThunk } from "@reduxjs/toolkit";
import type { RootState } from "../../app/store";
import {
  apiRequest,
  fetchCsrfToken,
  refreshSession,
} from "../../api/client";
import type { ApiError } from "../../api/errors";
import type { AdminUser } from "../../api/types";
import {
  loggedOut,
  setAnonymous,
  setAuthenticated,
  setAwaitingTwoFactor,
  setCsrfToken,
  updateUser,
} from "./authSlice";

export const bootstrapSession = createAsyncThunk<
  AdminUser | null,
  void,
  { state: RootState }
>("auth/bootstrap", async (_arg, { dispatch, getState }) => {
  let csrf = getState().auth.csrfToken ?? (await fetchCsrfToken());
  if (csrf) dispatch(setCsrfToken(csrf));

  let result = await apiRequest<{ admin: AdminUser }>("/auth/me", {
    csrfToken: csrf,
  });

  if (!result.ok && result.error.status === 401) {
    const refreshed = await refreshSession(csrf);
    csrf = refreshed.csrfToken;
    if (csrf) dispatch(setCsrfToken(csrf));
    if (refreshed.ok) {
      result = await apiRequest<{ admin: AdminUser }>("/auth/me", {
        csrfToken: csrf,
      });
    }
  }

  if (result.ok) {
    dispatch(setAuthenticated(result.data.admin));
    return result.data.admin;
  }

  dispatch(setAnonymous());
  return null;
});

export type LoginResult = { requires2fa: boolean };

export const login = createAsyncThunk<
  LoginResult,
  { email: string; password: string },
  { state: RootState; rejectValue: ApiError }
>("auth/login", async (input, { dispatch, getState, rejectWithValue }) => {
  let csrf = getState().auth.csrfToken ?? (await fetchCsrfToken());
  if (csrf) dispatch(setCsrfToken(csrf));

  let result = await apiRequest<
    { admin?: AdminUser; csrfToken?: string } & { requires2fa?: boolean }
  >("/auth/login", {
    method: "POST",
    body: input,
    csrfToken: csrf,
  });

  if (!result.ok && result.error.status === 403) {
    csrf = await fetchCsrfToken();
    if (csrf) dispatch(setCsrfToken(csrf));
    result = await apiRequest<
      { admin?: AdminUser; csrfToken?: string } & { requires2fa?: boolean }
    >("/auth/login", { method: "POST", body: input, csrfToken: csrf });
  }

  if (!result.ok) return rejectWithValue(result.error);

  if (result.data.csrfToken) dispatch(setCsrfToken(result.data.csrfToken));

  if (result.data.requires2fa) {
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
  if (result.data.csrfToken) dispatch(setCsrfToken(result.data.csrfToken));
  dispatch(setAuthenticated(result.data.admin));
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
    dispatch(loggedOut());
  },
);

export const refreshCsrf = createAsyncThunk<void, void>(
  "auth/refreshCsrf",
  async (_arg, { dispatch }) => {
    const token = await fetchCsrfToken();
    if (token) dispatch(setCsrfToken(token));
  },
);

export const setTwoFactorEnabled = createAsyncThunk<void, boolean>(
  "auth/setTwoFactorEnabled",
  async (enabled, { dispatch }) => {
    dispatch(updateUser({ totpEnabled: enabled }));
  },
);

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ApiError } from "../../api/errors";
import type { AdminUser } from "../../api/types";

export type AuthStatus =
  | "unknown"
  | "authenticated"
  | "anonymous"
  | "awaiting2fa"
  /** The session probe could not reach the API; the admin stays signed in. */
  | "unavailable";

export type AuthState = {
  status: AuthStatus;
  user: AdminUser | null;
  /** Memory only — never persisted, never placed in storage. */
  csrfToken: string | null;
  sessionExpiredAt: number | null;
  /** The real reason the last session probe failed, for the error panel. */
  error: ApiError | null;
  /**
   * A password has been accepted and a code is still required. This is NOT a
   * session: no access/refresh token, no `has_session` hint.
   */
  pendingTwoFactor: boolean;
};

const initialState: AuthState = {
  status: "unknown",
  user: null,
  csrfToken: null,
  sessionExpiredAt: null,
  error: null,
  pendingTwoFactor: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCsrfToken(state, action: PayloadAction<string | null>) {
      state.csrfToken = action.payload;
    },
    setAuthenticated(state, action: PayloadAction<AdminUser>) {
      state.status = "authenticated";
      state.user = action.payload;
      state.sessionExpiredAt = null;
      state.error = null;
      state.pendingTwoFactor = false;
    },
    setAnonymous(state) {
      state.status = "anonymous";
      state.user = null;
      state.sessionExpiredAt = null;
      state.error = null;
      state.pendingTwoFactor = false;
    },
    setAwaitingTwoFactor(state) {
      state.status = "awaiting2fa";
      state.user = null;
      state.pendingTwoFactor = true;
    },
    /**
     * The pending challenge was cancelled. Only the half-finished login is
     * dropped; a fully authenticated session (a late cancel from the code
     * screen's unmount) is left untouched.
     */
    twoFactorCancelled(state) {
      state.pendingTwoFactor = false;
      if (state.status === "awaiting2fa") state.status = "anonymous";
    },
    setSessionUnavailable(state, action: PayloadAction<ApiError>) {
      // A 503/network failure must never look like a sign-out: keep the user
      // and the CSRF token so a retry can succeed.
      state.status = "unavailable";
      state.error = action.payload;
    },
    sessionExpired(state) {
      state.status = "anonymous";
      state.user = null;
      state.csrfToken = null;
      state.sessionExpiredAt = Date.now();
      state.error = null;
      state.pendingTwoFactor = false;
    },
    loggedOut(state) {
      state.status = "anonymous";
      state.user = null;
      state.csrfToken = null;
      state.sessionExpiredAt = null;
      state.error = null;
      state.pendingTwoFactor = false;
    },
    updateUser(state, action: PayloadAction<Partial<AdminUser>>) {
      if (state.user) state.user = { ...state.user, ...action.payload };
    },
  },
});

export const {
  setCsrfToken,
  setAuthenticated,
  setAnonymous,
  setAwaitingTwoFactor,
  twoFactorCancelled,
  setSessionUnavailable,
  sessionExpired,
  loggedOut,
  updateUser,
} = authSlice.actions;

export default authSlice.reducer;

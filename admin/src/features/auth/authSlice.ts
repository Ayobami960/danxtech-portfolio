import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AdminUser } from "../../api/types";

export type AuthStatus = "unknown" | "authenticated" | "anonymous" | "awaiting2fa";

export type AuthState = {
  status: AuthStatus;
  user: AdminUser | null;
  /** Memory only — never persisted, never placed in storage. */
  csrfToken: string | null;
  sessionExpiredAt: number | null;
};

const initialState: AuthState = {
  status: "unknown",
  user: null,
  csrfToken: null,
  sessionExpiredAt: null,
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
    },
    setAnonymous(state) {
      state.status = "anonymous";
      state.user = null;
      state.sessionExpiredAt = null;
    },
    setAwaitingTwoFactor(state) {
      state.status = "awaiting2fa";
      state.user = null;
    },
    sessionExpired(state) {
      state.status = "anonymous";
      state.user = null;
      state.csrfToken = null;
      state.sessionExpiredAt = Date.now();
    },
    loggedOut(state) {
      state.status = "anonymous";
      state.user = null;
      state.csrfToken = null;
      state.sessionExpiredAt = null;
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
  sessionExpired,
  loggedOut,
  updateUser,
} = authSlice.actions;

export default authSlice.reducer;

import {
  configureStore,
  createListenerMiddleware,
  isAnyOf,
} from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { adminApi } from "../api/adminApi";
import authReducer, { loggedOut, sessionExpired } from "../features/auth/authSlice";
import { bootstrapSession, login } from "../features/auth/thunks";
import uiReducer, { resetUi } from "../features/ui/uiSlice";
import realtimeReducer, { resetRealtime } from "../realtime/realtimeSlice";
import {
  connectRealtime,
  disconnectRealtime,
} from "../realtime/socket";
import { refreshCsrf } from "../features/auth/thunks";
import { consumeRemoteLogout, broadcastLogout } from "./channel";
import { navigateTo } from "./navigation";

const listener = createListenerMiddleware();

listener.startListening({
  actionCreator: sessionExpired,
  effect: (_action, api) => {
    const current = window.location.pathname + window.location.search;
    api.dispatch(loggedOut());
    navigateTo(`/login?next=${encodeURIComponent(current)}`, { replace: true });
  },
});

listener.startListening({
  actionCreator: loggedOut,
  effect: (_action, api) => {
    disconnectRealtime();
    api.dispatch(adminApi.util.resetApiState());
    api.dispatch(resetRealtime());
    api.dispatch(resetUi());
    if (!consumeRemoteLogout()) broadcastLogout();
  },
});

listener.startListening({
  actionCreator: login.fulfilled,
  effect: (_action, api) => {
    connectRealtime();
    void api.dispatch(refreshCsrf());
    void api.dispatch(adminApi.endpoints.getStats.initiate());
  },
});

listener.startListening({
  matcher: isAnyOf(bootstrapSession.fulfilled),
  effect: (action) => {
    if (bootstrapSession.fulfilled.match(action) && action.payload) {
      connectRealtime();
    }
  },
});

export const store = configureStore({
  reducer: {
    [adminApi.reducerPath]: adminApi.reducer,
    auth: authReducer,
    ui: uiReducer,
    realtime: realtimeReducer,
  },
  middleware: (getDefault) =>
    getDefault({
      serializableCheck: {
        // Errors are plain objects; check the whole state in development.
        ignoredActionPaths: ["payload.file"],
      },
      immutableCheck: true,
    }).concat(adminApi.middleware, listener.middleware),
  devTools: import.meta.env.DEV,
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { sessionExpired } from "../features/auth/authSlice";
import { refreshCsrf } from "../features/auth/thunks";
import {
  connectRealtime,
  connectionStatus,
  onAuthExpired,
  onRealtime,
  onSessionRevoked,
  onStatus,
} from "./socket";
import {
  setConnection,
  setPresence,
  setTyping,
} from "./realtimeSlice";

export const RealtimeBridge = () => {
  const dispatch = useAppDispatch();
  const status = useAppSelector((state) => state.auth.status);

  useEffect(() => {
    if (status !== "authenticated") return;

    const offStatus = onStatus((next) => dispatch(setConnection(next)));
    const offPresence = onRealtime("presence", (payload) => {
      const data = payload as {
        conversationId?: string;
        visitorOnline?: boolean;
        adminOnline?: boolean;
        adminViewing?: boolean;
      };
      if (!data.conversationId) return;
      dispatch(
        setPresence({
          conversationId: data.conversationId,
          visitorOnline: Boolean(data.visitorOnline),
          adminOnline: Boolean(data.adminOnline),
          adminViewing: Boolean(data.adminViewing),
        }),
      );
    });
    const offTyping = onRealtime("typing", (payload) => {
      const data = payload as {
        conversationId?: string;
        from?: "visitor" | "admin";
        isTyping?: boolean;
      };
      if (!data.conversationId || data.from !== "visitor") return;
      dispatch(
        setTyping({
          conversationId: data.conversationId,
          isTyping: Boolean(data.isTyping),
        }),
      );
    });
    const offAuth = onAuthExpired(() => {
      void (async () => {
        await dispatch(refreshCsrf());
        connectRealtime();
        setTimeout(() => {
          if (connectionStatus() !== "live") dispatch(sessionExpired());
        }, 1_500);
      })();
    });
    const offRevoked = onSessionRevoked(() => dispatch(sessionExpired()));

    connectRealtime();

    return () => {
      offStatus();
      offPresence();
      offTyping();
      offAuth();
      offRevoked();
    };
  }, [status, dispatch]);

  return null;
};

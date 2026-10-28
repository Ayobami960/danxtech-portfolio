import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../../api/client";
import { broadcastActivity, subscribeChannel } from "../../app/channel";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { logout } from "./thunks";

const IDLE_MS = 30 * 60 * 1000;
const WARN_MS = 28 * 60 * 1000;
const ACTIVITY_BROADCAST_MS = 15_000;

export const useIdleLogout = () => {
  const dispatch = useAppDispatch();
  const status = useAppSelector((state) => state.auth.status);
  const uploading = useAppSelector((state) =>
    state.uploads.ids.some((id) => state.uploads.entities[id]?.status === "uploading"),
  );
  const lastActivity = useRef(0);
  const lastBroadcast = useRef(0);
  const [warning, setWarning] = useState(false);

  const markActive = useCallback(() => {
    lastActivity.current = Date.now();
    setWarning(false);
    if (Date.now() - lastBroadcast.current > ACTIVITY_BROADCAST_MS) {
      lastBroadcast.current = Date.now();
      broadcastActivity();
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    lastActivity.current = Date.now();
    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "scroll",
      "touchstart",
    ];
    for (const event of events) {
      window.addEventListener(event, markActive, { passive: true });
    }
    const unsubscribe = subscribeChannel({
      onLogout: () => undefined,
      onActivity: () => {
        lastActivity.current = Date.now();
        setWarning(false);
      },
    });
    return () => {
      for (const event of events) window.removeEventListener(event, markActive);
      unsubscribe();
    };
  }, [status, markActive]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const timer = setInterval(() => {
      if (uploading) {
        lastActivity.current = Date.now();
        return;
      }
      const idle = Date.now() - lastActivity.current;
      if (idle >= IDLE_MS) {
        setWarning(false);
        void dispatch(logout());
      } else if (idle >= WARN_MS) {
        setWarning(true);
      }
    }, 20_000);
    return () => clearInterval(timer);
  }, [status, uploading, dispatch]);

  const staySignedIn = async (): Promise<void> => {
    await apiRequest("/auth/me");
    markActive();
  };

  return { warning, staySignedIn, markActive };
};

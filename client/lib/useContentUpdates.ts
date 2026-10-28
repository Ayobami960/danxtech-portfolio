"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { contentEventsUrl, contentVersionUrl } from "./api/client";
import { UPDATE_MODE, type UpdateMode } from "./update-config";

export type UpdatePhase = "idle" | "updating" | "success" | "error";

/** Several events inside this window produce one refresh, not a flicker. */
const DEBOUNCE_MS = 500;
const SUCCESS_MS = 2_500;
/** A refresh that never settles must not leave the overlay up forever. */
const REFRESH_TIMEOUT_MS = 12_000;
/** Used when the transition never reports `pending`. */
const SETTLE_MS = 400;
const POLL_MS = 20_000;
const RELOAD_DELAY_MS = 1_000;
const SSE_FAILURES_BEFORE_POLLING = 3;

type Timer = ReturnType<typeof setTimeout>;
type TimerRef = { current: Timer | null };

const clearTimer = (timer: TimerRef): void => {
  if (timer.current !== null) {
    clearTimeout(timer.current);
    timer.current = null;
  }
};

type Options = { enabled?: boolean };

/**
 * One place for the content-update transport, mounted once at the app root.
 *
 * Primary channel: EventSource on GET /api/events. When SSE cannot connect it
 * falls back to polling a cheap version probe every 20s (and on window focus).
 * Every notification refreshes the current route in place, except in "reload"
 * mode where the whole page is reloaded.
 */
export const useContentUpdates = ({ enabled = true }: Options = {}) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [phase, setPhase] = useState<UpdatePhase>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const inFlight = useRef(false);
  const sawPending = useRef(false);

  const debounceTimer = useRef<Timer | null>(null);
  const refreshTimer = useRef<Timer | null>(null);
  const settleTimer = useRef<Timer | null>(null);
  const successTimer = useRef<Timer | null>(null);
  const reloadTimer = useRef<Timer | null>(null);

  const finishSuccess = useCallback(() => {
    clearTimer(refreshTimer);
    clearTimer(settleTimer);
    inFlight.current = false;
    sawPending.current = false;
    setPhase("success");
    clearTimer(successTimer);
    successTimer.current = setTimeout(() => {
      successTimer.current = null;
      setPhase("idle");
    }, SUCCESS_MS);
  }, []);

  const fail = useCallback((reason: string) => {
    clearTimer(refreshTimer);
    clearTimer(settleTimer);
    inFlight.current = false;
    sawPending.current = false;
    setMessage(reason);
    setPhase("error");
  }, []);

  const startUpdate = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    sawPending.current = false;
    setMessage(null);

    if (UPDATE_MODE === "reload") {
      setPhase("updating");
      clearTimer(reloadTimer);
      reloadTimer.current = setTimeout(() => {
        window.location.reload();
      }, RELOAD_DELAY_MS);
      return;
    }

    setPhase("updating");
    clearTimer(refreshTimer);
    refreshTimer.current = setTimeout(() => {
      fail("The update took too long to load. Please try again.");
    }, REFRESH_TIMEOUT_MS);

    startTransition(() => {
      router.refresh();
    });

    // A fully cached refresh can finish before React reports a pending
    // transition; settle it instead of waiting for the timeout.
    clearTimer(settleTimer);
    settleTimer.current = setTimeout(() => {
      if (inFlight.current && !sawPending.current) finishSuccess();
    }, SETTLE_MS);
  }, [fail, finishSuccess, router]);

  useEffect(() => {
    if (!inFlight.current || UPDATE_MODE !== "refetch") return;
    if (isPending) {
      sawPending.current = true;
      return;
    }
    if (sawPending.current) finishSuccess();
  }, [isPending, finishSuccess]);

  const retry = useCallback(() => {
    if (inFlight.current) return;
    startUpdate();
  }, [startUpdate]);

  const schedule = useCallback(() => {
    if (!enabled) return;
    clearTimer(debounceTimer);
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      startUpdate();
    }, DEBOUNCE_MS);
  }, [enabled, startUpdate]);

  useEffect(() => {
    if (!enabled) return;

    let source: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let lastVersion: string | null = null;
    let firstOpen = true;
    let failures = 0;
    let disposed = false;

    const checkVersion = async (): Promise<void> => {
      try {
        const response = await fetch(contentVersionUrl(), {
          cache: "no-store",
        });
        if (!response.ok || disposed) return;
        const body = (await response.json()) as { version?: unknown };
        if (typeof body.version !== "string" || disposed) return;
        if (lastVersion === null) {
          lastVersion = body.version;
          return;
        }
        if (body.version !== lastVersion) {
          lastVersion = body.version;
          schedule();
        }
      } catch {
        // The next poll retries; a failed probe never affects the page.
      }
    };

    const startPolling = (): void => {
      if (pollTimer) return;
      void checkVersion();
      pollTimer = setInterval(() => {
        void checkVersion();
      }, POLL_MS);
      window.addEventListener("focus", checkVersion);
    };

    const stopPolling = (): void => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      window.removeEventListener("focus", checkVersion);
    };

    if (typeof EventSource === "undefined") {
      startPolling();
      return stopPolling;
    }

    // Baseline before listening, so a change that happens while the stream is
    // down is still detected by the polling fallback.
    void checkVersion();

    source = new EventSource(contentEventsUrl());
    source.onopen = () => {
      failures = 0;
      stopPolling();
      // Catch up on anything missed while the stream was down; the first
      // open of a fresh page needs no extra check.
      if (!firstOpen) void checkVersion();
      firstOpen = false;
    };
    source.onmessage = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as { type?: unknown };
        if (payload.type === "content-updated") schedule();
      } catch {
        // Malformed frames are ignored; the stream stays usable.
      }
    };
    source.onerror = () => {
      // EventSource retries on its own. After repeated failures, poll as a
      // safety net; a later successful open stops the polling again.
      failures += 1;
      if (failures >= SSE_FAILURES_BEFORE_POLLING) startPolling();
    };

    return () => {
      disposed = true;
      source?.close();
      stopPolling();
    };
  }, [enabled, schedule]);

  useEffect(
    () => () => {
      clearTimer(debounceTimer);
      clearTimer(refreshTimer);
      clearTimer(settleTimer);
      clearTimer(successTimer);
      clearTimer(reloadTimer);
    },
    [],
  );

  return {
    phase,
    message,
    retry,
    updateMode: UPDATE_MODE as UpdateMode,
  };
};

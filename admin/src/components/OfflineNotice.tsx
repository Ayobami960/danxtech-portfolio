import { useEffect, useState } from "react";

const isOffline = (): boolean =>
  typeof navigator !== "undefined" && navigator.onLine === false;

/**
 * Subtle global banner. Query refetching on reconnect is handled by RTK Query
 * (`setupListeners` + `refetchOnReconnect`), so this is purely informational.
 */
export const OfflineNotice = () => {
  const [offline, setOffline] = useState(isOffline);

  useEffect(() => {
    const update = (): void => setOffline(isOffline());
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 border-b border-amber-400/30 bg-amber-500/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-amber-200"
    >
      You&rsquo;re offline — data will reload when the connection returns
    </div>
  );
};

"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { usePathname } from "next/navigation";

const isOffline = (): boolean =>
  typeof navigator !== "undefined" && navigator.onLine === false;

/**
 * Mounted once in the root layout, so every public page shows the same
 * connection state. The chat route renders its own connection strip inside the
 * conversation panel, so it is skipped here to avoid two banners.
 *
 * Starts "online" on the server and first client render so hydration matches,
 * then corrects itself after mount from `navigator.onLine`.
 */
export default function OfflineBanner() {
  const pathname = usePathname();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = (): void => setOffline(isOffline());
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline || pathname?.startsWith("/chat")) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[110] flex justify-center px-6!">
      <div
        role="status"
        aria-live="polite"
        className="flex max-w-[calc(100vw-3rem)] items-center gap-2.5 rounded-full border border-[#f43f5e]/35 bg-[#1a1020]/95 px-4! py-2.5! font-mono text-[11px] leading-snug text-[#fca5a5] shadow-2xl backdrop-blur"
      >
        <WifiOff aria-hidden size={14} className="shrink-0" />
        <span>
          You&rsquo;re offline &mdash; showing the last loaded content. It
          refreshes when you&rsquo;re back online.
        </span>
      </div>
    </div>
  );
}

"use client";

import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { usePathname } from "next/navigation";
import { useContentUpdates } from "@/lib/useContentUpdates";

/**
 * Mounted once in the root layout: owns the content-update subscription and
 * renders the success toast and the retry state. The chat page is a separate
 * live surface and is excluded.
 *
 * Content updates are background work, so they never show a full-page loading
 * overlay: the current page stays usable and is replaced in place when the
 * refresh lands. The one loading screen is reserved for initial data.
 */
export default function UpdateOverlay() {
  const pathname = usePathname();
  const { phase, message, retry } = useContentUpdates({
    enabled: !pathname?.startsWith("/chat"),
  });

  if (phase === "success") {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[120] flex justify-center px-6!">
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2.5 rounded-full border border-[#10b981]/30 bg-[#0e1528] px-4! py-2.5! text-sm text-white shadow-2xl"
        >
          <CheckCircle2 aria-hidden size={16} className="text-[#10b981]" />
          Content updated
        </div>
      </div>
    );
  }

  // "idle" and "updating" render nothing: the refresh happens in place.
  if (phase !== "error") return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Update failed"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0a0f1e]/85 px-6! backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0e1528] p-8! text-center shadow-2xl">
        <AlertTriangle aria-hidden size={30} className="mx-auto text-[#f0a500]" />
        <p className="font-grotesk mt-4 text-lg font-semibold text-white">
          The update could not be loaded
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[#8fa1b8]">
          {message ?? "The latest content is temporarily unavailable."}
        </p>
        <button
          type="button"
          onClick={retry}
          className="font-grotesk mx-auto mt-6 inline-flex items-center gap-2 rounded-full bg-[#3b82f6] px-5! py-2.5! text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1528]"
        >
          <RefreshCw aria-hidden size={15} />
          Try again
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * Route-level error boundary. Section boundaries handle most failures; this
 * catches anything that escapes them (for example a render error) and keeps the
 * visitor on a usable page with a working Retry.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error.message);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a0f1e] px-6!">
      <div role="alert" className="w-full max-w-lg rounded-2xl border border-[#f43f5e]/25 bg-[#f43f5e]/5 p-8!">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#f43f5e]/30 bg-[#f43f5e]/10 text-[#f43f5e]">
          <AlertTriangle size={20} />
        </span>
        <h1 className="font-grotesk mt-5 text-xl font-bold text-white">
          This page could not be displayed
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#8fa1b8]">
          Something went wrong while loading the portfolio. Your connection and
          the server have been checked — retrying usually fixes it.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 px-5! py-2.5! text-sm font-medium text-white transition-colors hover:border-white/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b82f6]"
        >
          <RotateCw size={14} /> Try again
        </button>
      </div>
    </main>
  );
}

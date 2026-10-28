"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * Section-level failure state. One failing block renders this instead of
 * breaking the rest of the page; Retry re-runs the server render so only the
 * failed Suspense boundary fetches again.
 */
export default function SectionError({
  title,
  message,
  compact = false,
}: {
  title: string;
  message: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [attempted, setAttempted] = useState(false);

  const retry = () => {
    setAttempted(true);
    startTransition(() => router.refresh());
  };

  return (
    <div
      role="alert"
      aria-busy={isPending}
      className={`mx-auto w-full max-w-4xl rounded-2xl border border-[#f43f5e]/25 bg-[#f43f5e]/5 ${
        compact ? "p-5!" : "my-10! p-6! sm:p-8!"
      }`}
    >
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#f43f5e]/30 bg-[#f43f5e]/10 text-[#f43f5e]">
          <AlertTriangle size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-grotesk font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-[#8fa1b8]">{message}</p>
          {attempted && !isPending ? (
            <p className="mt-2 font-mono text-xs text-[#7c8fa6]">
              Still unavailable — the server may be starting up.
            </p>
          ) : null}
          <button
            type="button"
            onClick={retry}
            disabled={isPending}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 px-4! py-2! text-sm font-medium text-white transition-colors hover:border-white/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b82f6] disabled:opacity-60"
          >
            <RotateCw size={14} className={isPending ? "animate-spin" : undefined} />
            {isPending ? "Retrying…" : "Retry"}
          </button>
        </div>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";

/** Clear, friendly empty state — never a blank area. */
export default function EmptySection({
  label,
  message,
  action,
  className = "",
}: {
  label: string;
  message: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto max-w-3xl px-6! py-20! text-center ${className}`}>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#7c8fa6]">{label}</p>
      <p className="mt-3 text-sm leading-relaxed text-[#8fa1b8]">{message}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

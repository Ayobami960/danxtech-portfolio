"use client";

import { useRef, type CSSProperties, type MouseEvent, type ReactNode } from "react";

/**
 * Card with a soft spotlight that follows the cursor.
 * Put in: components/ui/SpotlightCard.tsx
 */
export default function SpotlightCard({
  children,
  className = "",
  glow = "rgba(59,130,246,.14)",
  style,
}: {
  children: ReactNode;
  className?: string;
  /** Any CSS colour, e.g. "rgba(239,68,68,.15)" or "#3b82f626" */
  glow?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--x", `${e.clientX - r.left}px`);
    el.style.setProperty("--y", `${e.clientY - r.top}px`);
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={`group relative overflow-hidden ${className}`}
      style={style}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(380px circle at var(--x, 50%) var(--y, 50%), ${glow}, transparent 45%)`,
        }}
      />
      <div className="relative h-full">{children}</div>
    </div>
  );
}
import { useAppSelector } from "../app/hooks";
import { cn } from "../lib/cn";

export const ConnectionPill = () => {
  const connection = useAppSelector((state) => state.realtime.connection);
  const label =
    connection === "live"
      ? "Live"
      : connection === "connecting"
        ? "Connecting"
        : connection === "reconnecting"
          ? "Reconnecting"
          : connection === "degraded"
            ? "Degraded"
            : "Offline";
  const tone =
    connection === "live"
      ? "border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
      : connection === "degraded" || connection === "offline"
        ? "border-[var(--color-amber)]/30 bg-[var(--color-amber-soft)] text-[var(--color-amber)]"
        : "border-[var(--color-line)] bg-[var(--color-section)] text-[var(--color-soft)]";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider",
        tone,
      )}
      title={
        connection === "degraded"
          ? "WebSockets unavailable — the inbox falls back to 5-second polling."
          : "Realtime connection"
      }
    >
      <span
      className={cn(
        "h-1.5 w-1.5 rounded-full",
        connection === "live"
          ? "bg-[var(--color-accent)]"
          : connection === "connecting" || connection === "reconnecting"
            ? "animate-pulse bg-[var(--color-amber)]"
            : "bg-[var(--color-amber)]",
      )}
      />
      {label}
    </span>
  );
};

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
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
      : connection === "degraded" || connection === "offline"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
        : "border-white/10 bg-white/5 text-[#9db0c6]";

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
            ? "bg-emerald-400"
            : connection === "connecting" || connection === "reconnecting"
              ? "animate-pulse bg-amber-300"
              : "bg-amber-400",
        )}
      />
      {label}
    </span>
  );
};

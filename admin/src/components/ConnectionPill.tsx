import { useAppSelector } from "../store/hooks";
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

  return (
    <span
      className={cn(
        "pill",
        connection === "live" && "live",
        (connection === "degraded" || connection === "offline") && "warn",
        (connection === "connecting" || connection === "reconnecting") && "pulse",
      )}
      title={
        connection === "degraded"
          ? "WebSockets unavailable — the inbox falls back to 5-second polling."
          : "Realtime connection"
      }
    >
      {label}
    </span>
  );
};

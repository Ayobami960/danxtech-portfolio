import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAppSelector } from "./hooks";

const FullScreenLoader = () => (
  <div className="glow-blue flex min-h-screen items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[#3b82f6]" />
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#7c8fa6]">
        Restoring session
      </p>
    </div>
  </div>
);

export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const status = useAppSelector((state) => state.auth.status);
  const location = useLocation();

  if (status === "unknown") return <FullScreenLoader />;
  if (status !== "authenticated") {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <>{children}</>;
};

export { FullScreenLoader };

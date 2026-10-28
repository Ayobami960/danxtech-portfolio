import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export const Card = ({
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) => (
  <section className={cn("window-card overflow-hidden", className)}>
    <header className="flex flex-wrap items-center gap-3 border-b border-white/5 bg-[#131c35]/80 px-4 py-3">
      <div className="flex items-center gap-1.5" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#ffbe2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c941]" />
      </div>
      {title ? (
        <div className="font-mono text-xs tracking-wide text-[#9db0c6]">{title}</div>
      ) : null}
      {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
    </header>
    <div className={cn("p-5", bodyClassName)}>{children}</div>
  </section>
);

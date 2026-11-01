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
    {title ? (
      <header className="border-b border-[var(--color-line)] px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="font-medium text-sm text-[var(--color-on-card)]">{title}</div>
          {actions ? (
            <div className="shrink-0 flex items-center gap-2">{actions}</div>
          ) : null}
        </div>
      </header>
    ) : actions ? (
      <div className="flex justify-end p-5">{actions}</div>
    ) : null}
    <div className={cn("p-5", title ? "border-t border-[var(--color-line)]" : "", bodyClassName)}>
      {!title && !actions ? children : children}
    </div>
  </section>
);

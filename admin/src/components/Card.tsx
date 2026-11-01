import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export const Card = ({
  title,
  meta,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  /** Small monospace key shown on the right of the header, e.g. `project_fields`. */
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) => (
  <section className={cn("card", className)}>
    {title || meta || actions ? (
      <header className="card-head">
        {title ? <h2>{title}</h2> : null}
        {meta || actions ? (
          <div className="card-side">
            {meta ? <small>{meta}</small> : null}
            {actions}
          </div>
        ) : null}
      </header>
    ) : null}
    <div className={cn("p-5", bodyClassName)}>{children}</div>
  </section>
);

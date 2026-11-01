import type { ReactNode } from "react";

export const PageHeader = ({
  eyebrow,
  back,
  title,
  description,
  actions,
}: {
  /** Quiet monospace line above the title (kept for pages that still pass it). */
  eyebrow?: string;
  /** Back link / breadcrumb rendered above the title. */
  back?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}) => (
  <div className="ph">
    <div className="min-w-0">
      {back}
      {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
    </div>
    {actions ? <div className="acts">{actions}</div> : null}
  </div>
);

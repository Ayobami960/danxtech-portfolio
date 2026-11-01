import type { ReactNode } from "react";

export const PageHeader = ({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) => (
  <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
    <div>
      {eyebrow ? (
        <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-accent)]">
          {eyebrow}
        </div>
      ) : null}
      <h1 className="font-grotesk text-2xl font-bold text-[var(--color-on-page)] sm:text-3xl">{title}</h1>
      {description ? (
        <p className="mt-1.5 max-w-2xl text-sm text-[var(--color-soft)]">{description}</p>
      ) : null}
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
);

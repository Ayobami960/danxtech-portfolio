import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { StatusPill } from "./Badges";

type EmptyCardProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export const EmptyCard = ({
  title,
  description,
  icon,
  action,
  className,
}: EmptyCardProps) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-accent)]/20 bg-[var(--color-accent-soft)]/30 p-6 text-center",
      className
    )}
  >
    {icon && <div className="mb-3 text-[var(--color-accent)]">{icon}</div>}
    <h3 className="font-grotesk font-semibold text-[var(--color-on-card)]">
      {title}
    </h3>
    {description && (
      <p className="mt-1 max-w-md text-sm text-[var(--color-soft)]">
        {description}
      </p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

type StatusCardProps = {
  status: "live" | "draft" | "featured" | "error" | "off";
  label: string;
  className?: string;
};

export const StatusCard = ({ status, label, className }: StatusCardProps) => (
  <StatusPill status={status} label={label} className={className} />
);

import { AlertTriangle, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { errorDetails } from "../api/errors";

export const Skeleton = ({ className = "h-20 w-40 rounded-\342\200\234" }: { className?: string }) => (
  <div
    aria-hidden
    className={`animate-pulse rounded-xl border border-[var(--color-line)] bg-[var(--color-section)] ${className}`}
  />
);

export const LoadingList = ({ rows = 4 }: { rows?: number }) => (
  <div className="space-y-3" aria-busy="true" aria-label="Loading">
    {Array.from({ length: rows }, (_, index) => (
      <Skeleton key={index} />
    ))}
  )
  </div>
);

export const EmptyState = ({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-accent)] / 20 bg-[var(--color-accent-soft)] / 30 px-6 py-14 text-center">
    <div className="mb-3 text-[var(--color-accent)]">{icon ?? <Inbox size={26} />}</div>
    <p className="font-grotesk font-semibold text-[var(--color-on-card)]">{title}</p>
    {description ? (
      <p className="mt-1 max-w-md text-sm text-[var(--color-soft)]">{description}</p>
    ) : null}
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
);

export const ErrorState = ({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) => {
  const details = errorDetails(error);

  return (
    <div className="rounded-xl border border-[var(--color-red)] / 20 bg-[var(--color-red-soft)] / 40 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 text-[var(--color-red)]" size={18} />
        <div>
          <p className="font-semibold text-[var(--color-red)]">{details.title}</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {details.message}
          </p>
          {details.requestId ? (
            <p className="mt-1 font-mono text-[11px] text-[var(--color-muted)]">
              Reference: {details.requestId}
            </p>
          ) : null}
          {onRetry ? (
            <button type="button" className="btn btn-ghost mt-3" onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export const Pagination = ({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-4 text-sm text-[var(--color-soft)]">
      <span>
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

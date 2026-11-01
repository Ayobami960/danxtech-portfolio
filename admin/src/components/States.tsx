import { AlertTriangle, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { errorDetails } from "../api/errors";
import { cn } from "../lib/cn";

export const Skeleton = ({ className = "h-20" }: { className?: string }) => (
  <div aria-hidden className={cn("skel", className)} />
);

export const LoadingList = ({ rows = 4 }: { rows?: number }) => (
  <div className="grid gap-3" aria-busy="true" aria-label="Loading">
    {Array.from({ length: rows }, (_, index) => (
      <Skeleton key={index} />
    ))}
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
  <div className="empty">
    <div className="ico">{icon ?? <Inbox size={26} />}</div>
    <b>{title}</b>
    {description ? <span className="max-w-md text-sm">{description}</span> : null}
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
    <div className="err-state" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 shrink-0" size={18} style={{ color: "var(--bad)" }} />
        <div>
          <p className="font-semibold">{details.title}</p>
          <p className="sub">{details.message}</p>
          {details.requestId ? (
            <p className="sub font-mono text-[11px]">
              Reference: {details.requestId}
            </p>
          ) : null}
          {onRetry ? (
            <button type="button" className="btn mt-3" onClick={onRetry}>
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
    <div className="pager">
      <span>
        Page {page} of {pages} · {total} total
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          className="btn"
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

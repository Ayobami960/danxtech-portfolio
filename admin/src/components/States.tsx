import { AlertTriangle, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { errorMessage } from "../api/errors";

export const Skeleton = ({ className = "h-20" }: { className?: string }) => (
  <div
    aria-hidden
    className={`animate-pulse rounded-xl border border-white/5 bg-white/[0.03] ${className}`}
  />
);

export const LoadingList = ({ rows = 4 }: { rows?: number }) => (
  <div className="space-y-3" aria-busy="true" aria-label="Loading">
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
  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 px-6 py-14 text-center">
    <div className="mb-3 text-[#3b82f6]">{icon ?? <Inbox size={26} />}</div>
    <p className="font-grotesk font-semibold text-white">{title}</p>
    {description ? (
      <p className="mt-1 max-w-md text-sm text-[#7c8fa6]">{description}</p>
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
}) => (
  <div className="rounded-xl border border-red-400/20 bg-red-500/5 p-5">
    <div className="flex items-start gap-3">
      <AlertTriangle className="mt-0.5 text-red-400" size={18} />
      <div>
        <p className="font-semibold text-red-200">Could not load this view</p>
        <p className="mt-1 text-sm text-red-200/70">
          {errorMessage(error, "The API did not respond as expected.")}
        </p>
        {onRetry ? (
          <button type="button" className="btn btn-ghost mt-3" onClick={onRetry}>
            Retry
          </button>
        ) : null}
      </div>
    </div>
  </div>
);

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
    <div className="flex items-center justify-between pt-4 text-sm text-[#7c8fa6]">
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

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { ConversationFilters } from "../../api/adminApi";
import { useGetConversationsQuery } from "../../api/adminApi";
import type { Conversation } from "../../api/types";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { Pagination, EmptyState, ErrorState, LoadingList } from "../../components/States";
import { cn } from "../../lib/cn";
import { relativeTime } from "../../lib/format";
import {
  setInboxPage,
  setInboxSearch,
  setInboxView,
  type InboxView,
} from "../ui/uiSlice";

const VIEWS: { key: InboxView; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "open", label: "Open" },
  { key: "closed", label: "Closed" },
  { key: "archived", label: "Archived" },
  { key: "starred", label: "Starred" },
  { key: "spam", label: "Spam" },
  { key: "unread", label: "Unread" },
];

const filterArgs = (
  view: InboxView,
  q: string,
  page: number,
): ConversationFilters & { page: number; pageSize: number } => ({
  page,
  pageSize: 20,
  ...(view === "new" ? { status: "new" as const } : {}),
  ...(view === "open" ? { status: "open" as const } : {}),
  ...(view === "closed" ? { status: "closed" as const } : {}),
  ...(view === "archived" ? { status: "archived" as const } : {}),
  ...(view === "starred" ? { starred: true } : {}),
  ...(view === "spam" ? { isSpam: true } : {}),
  ...(view === "unread" ? { unread: true } : {}),
  ...(q ? { q } : {}),
});

const StatusChip = ({ status }: { status: Conversation["status"] }) => (
  <span
    className={cn(
      "rounded-full border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide",
      status === "new"
        ? "border-[#3b82f6]/40 bg-[#3b82f6]/15 text-[#93c5fd]"
        : status === "open"
          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
          : status === "archived"
            ? "border-[#f0a500]/30 bg-[#f0a500]/10 text-[#f0a500]"
            : "border-white/10 bg-white/5 text-[#7c8fa6]",
    )}
  >
    {status}
  </span>
);

export const ConversationList = ({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (conversation: Conversation) => void;
}) => {
  const dispatch = useAppDispatch();
  const { view, q, page } = useAppSelector((state) => state.ui.inbox);
  const connection = useAppSelector((state) => state.realtime.connection);
  const presence = useAppSelector((state) => state.realtime.presenceByConversation);
  const [search, setSearch] = useState(q);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== q) dispatch(setInboxSearch(search));
    }, 300);
    return () => clearTimeout(timer);
  }, [search, q, dispatch]);

  const query = useGetConversationsQuery(filterArgs(view, q, page), {
    pollingInterval: connection === "live" ? 0 : 5_000,
    refetchOnFocus: true,
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-white/5 p-3">
        <div className="flex flex-wrap gap-1">
          {VIEWS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => dispatch(setInboxView(entry.key))}
              className={cn(
                "rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wide transition-colors",
                view === entry.key
                  ? "bg-[#3b82f6]/20 text-white ring-1 ring-[#3b82f6]/30"
                  : "text-[#7c8fa6] hover:bg-white/5 hover:text-white",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <label className="relative mt-2 block">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5f7189]"
          />
          <span className="sr-only">Search conversations</span>
          <input
            className="field pl-8"
            value={search}
            placeholder="Search name, email, subject…"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {query.isLoading ? (
          <LoadingList rows={5} />
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={query.refetch} />
        ) : query.data && query.data.data.length > 0 ? (
          <ul className="space-y-1">
            {query.data.data.map((conversation) => (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => onSelect(conversation)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                    selectedId === conversation.id
                      ? "border-[#3b82f6]/40 bg-[#3b82f6]/10"
                      : "border-transparent hover:border-white/10 hover:bg-white/5",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#3b82f6]/15 font-mono text-[10px] text-[#93c5fd]">
                      {conversation.visitorName.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
                      {conversation.visitorName}
                    </span>
                    {presence[conversation.id]?.visitorOnline ? (
                      <span
                        className="h-2 w-2 rounded-full bg-emerald-400"
                        title="Visitor online"
                      />
                    ) : null}
                    <span className="shrink-0 text-[10px] text-[#5f7189]">
                      {relativeTime(conversation.lastMessageAt)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <StatusChip status={conversation.status} />
                    {conversation.isSpam ? (
                      <span className="rounded-full border border-red-400/30 bg-red-400/10 px-1.5 py-0.5 font-mono text-[9px] uppercase text-red-300">
                        spam
                      </span>
                    ) : null}
                    {conversation.starred ? (
                      <span className="text-[10px] text-[#f0a500]">★</span>
                    ) : null}
                    {conversation.unreadForAdmin > 0 ? (
                      <span className="ml-auto rounded-full bg-[#3b82f6] px-1.5 py-0.5 font-mono text-[9px] font-bold text-white">
                        {conversation.unreadForAdmin}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 truncate text-xs text-[#7c8fa6]">
                    {conversation.subject ? (
                      <span className="text-[#9db0c6]">{conversation.subject} · </span>
                    ) : null}
                    {conversation.lastMessagePreview || "No messages yet"}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title={view === "all" ? "No conversations yet" : "Nothing matches that filter"}
            description="Contact-form submissions open a conversation here instantly."
          />
        )}
      </div>

      <div className="border-t border-white/5 px-3 pb-3">
        {query.data ? (
          <Pagination
            page={page}
            pageSize={20}
            total={query.data.meta.total}
            onPage={(next) => dispatch(setInboxPage(next))}
          />
        ) : null}
      </div>
    </div>
  );
};

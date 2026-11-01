import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { ConversationFilters } from "../../api/adminApi";
import { useGetConversationsQuery } from "../../api/adminApi";
import type { Conversation } from "../../api/types";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
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
  <span className={cn("cx-chip", status)}>{status}</span>
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
    <div className="cx-panel">
      <div className="cx-list-head">
        <div className="cx-pills" role="tablist" aria-label="Conversation filters">
          {VIEWS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={view === entry.key}
              onClick={() => dispatch(setInboxView(entry.key))}
              className={cn("cx-pill", view === entry.key && "on")}
            >
              {entry.label}
            </button>
          ))}
        </div>
        <label className="cx-search">
          <Search size={14} />
          <span className="sr-only">Search conversations</span>
          <input
            value={search}
            placeholder="Search name, email, subject…"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      <div className="cx-rows">
        {query.isLoading ? (
          <LoadingList rows={5} />
        ) : query.error ? (
          <ErrorState error={query.error} onRetry={query.refetch} />
        ) : query.data && query.data.data.length > 0 ? (
          <ul>
            {query.data.data.map((conversation) => {
              const unread = conversation.unreadForAdmin;
              const online = presence[conversation.id]?.visitorOnline;
              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(conversation)}
                    className={cn("cx-row", selectedId === conversation.id && "sel")}
                  >
                    <div className="cx-row-top">
                      <span className={cn("cx-avatar", unread > 0 && "hot")}>
                        {conversation.visitorName.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="cx-row-name">{conversation.visitorName}</span>
                      {online ? <span className="cx-online" title="Visitor online" /> : null}
                      <span className="cx-row-time">
                        {relativeTime(conversation.lastMessageAt)}
                      </span>
                    </div>
                    <div className="cx-row-meta">
                      <StatusChip status={conversation.status} />
                      {conversation.isSpam ? <span className="cx-chip spam">spam</span> : null}
                      {conversation.starred ? <span className="cx-star">★</span> : null}
                      {unread > 0 ? (
                        <span className="cx-badge" style={{ marginLeft: "auto" }}>
                          {unread}
                        </span>
                      ) : null}
                    </div>
                    <div className="cx-row-prev">
                      {conversation.subject ? <b>{conversation.subject} · </b> : null}
                      {conversation.lastMessagePreview || "No messages yet"}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title={view === "all" ? "No conversations yet" : "Nothing matches that filter"}
            description="Contact-form submissions open a conversation here instantly."
          />
        )}
      </div>

      {query.data ? (
        <div className="cx-list-foot">
          <Pagination
            page={page}
            pageSize={20}
            total={query.data.meta.total}
            onPage={(next) => dispatch(setInboxPage(next))}
          />
        </div>
      ) : null}
    </div>
  );
};
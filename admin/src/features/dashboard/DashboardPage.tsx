import {
  ArrowUpRight,
  Download,
  FolderKanban,
  Inbox,
  MessageSquare,
  Plus,
  Upload,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  useGetActivityQuery,
  useGetConversationsQuery,
  useGetStatsQuery,
} from "../../api/adminApi";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { ErrorState, LoadingList, Skeleton } from "../../components/States";
import { formatDate, relativeTime, titleCase } from "../../lib/format";

const StatCard = ({
  label,
  value,
  hint,
  icon,
  accent = "#3b82f6",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
  accent?: string;
}) => (
  <div className="window-card relative overflow-hidden p-4">
    <div
      aria-hidden
      className="absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl"
      style={{ background: `${accent}22` }}
    />
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#7c8fa6]">
          {label}
        </div>
        <div className="mt-2 font-grotesk text-2xl font-bold text-white">{value}</div>
        {hint ? <div className="mt-1 text-[11px] text-[#5f7189]">{hint}</div> : null}
      </div>
      <span
        className="flex h-9 w-9 items-center justify-center rounded-lg border"
        style={{ borderColor: `${accent}33`, background: `${accent}12`, color: accent }}
      >
        {icon}
      </span>
    </div>
  </div>
);

export default function DashboardPage() {
  const stats = useGetStatsQuery();
  const conversations = useGetConversationsQuery({ page: 1, pageSize: 5 });
  const activity = useGetActivityQuery({ page: 1, pageSize: 8 });

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="A quick read on your inbox, published work and the last change to the site."
        actions={
          <>
            <Link to="/projects/new" className="btn btn-primary">
              <Plus size={15} /> New project
            </Link>
            <Link to="/resume" className="btn btn-ghost">
              <Upload size={15} /> Upload resume
            </Link>
          </>
        }
      />

      {stats.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
      ) : stats.error ? (
        <ErrorState error={stats.error} onRetry={stats.refetch} />
      ) : stats.data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Unread chats"
            value={stats.data.conversations.unread}
            hint={`${stats.data.conversations.total} conversations`}
            icon={<Inbox size={17} />}
          />
          <StatCard
            label="Open conversations"
            value={stats.data.conversations.open}
            hint={`${stats.data.messages.total} contact-form messages`}
            icon={<MessageSquare size={17} />}
            accent="#f0a500"
          />
          <StatCard
            label="Projects"
            value={`${stats.data.projects.published}/${stats.data.projects.total}`}
            hint={`${stats.data.projects.draft} draft`}
            icon={<FolderKanban size={17} />}
            accent="#34d399"
          />
          <StatCard
            label="Resume downloads"
            value={stats.data.resume.downloadCount}
            hint={
              stats.data.resume.available
                ? `Updated ${stats.data.resume.updatedAt ? relativeTime(stats.data.resume.updatedAt) : "—"}`
                : "No resume uploaded"
            }
            icon={<Download size={17} />}
            accent="#a78bfa"
          />
        </div>
      ) : null}

      <div className="mt-3 font-mono text-[11px] text-[#5f7189]">
        Last content update:{" "}
        <span className="text-[#9db0c6]">
          {stats.data?.lastContentUpdate
            ? formatDate(stats.data.lastContentUpdate)
            : "—"}
        </span>
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <Card
          title="latest_conversations"
          actions={
            <Link to="/inbox" className="text-xs text-[#3b82f6] hover:underline">
              Open inbox
            </Link>
          }
          bodyClassName="p-3"
        >
          {conversations.isLoading ? (
            <LoadingList rows={4} />
          ) : conversations.error ? (
            <ErrorState error={conversations.error} onRetry={conversations.refetch} />
          ) : conversations.data && conversations.data.data.length > 0 ? (
            <ul className="divide-y divide-white/5">
              {conversations.data.data.map((conversation) => (
                <li key={conversation.id}>
                  <Link
                    to={`/inbox/${conversation.id}`}
                    className="flex items-start gap-3 rounded-lg px-2 py-3 hover:bg-white/5"
                  >
                    <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3b82f6]/15 font-mono text-xs text-[#93c5fd]">
                      {conversation.visitorName.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-white">
                          {conversation.visitorName}
                        </span>
                        {conversation.unreadForAdmin > 0 ? (
                          <span className="rounded-full bg-[#3b82f6] px-1.5 py-0.5 font-mono text-[10px] text-white">
                            {conversation.unreadForAdmin}
                          </span>
                        ) : null}
                        <span className="ml-auto shrink-0 text-[11px] text-[#5f7189]">
                          {relativeTime(conversation.lastMessageAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-[#7c8fa6]">
                        {conversation.lastMessagePreview || conversation.subject || "No messages yet"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-8 text-center text-sm text-[#7c8fa6]">
              No conversations yet.
            </p>
          )}
        </Card>

        <Card title="recent_activity" bodyClassName="p-3">
          {activity.isLoading ? (
            <LoadingList rows={5} />
          ) : activity.error ? (
            <ErrorState error={activity.error} onRetry={activity.refetch} />
          ) : activity.data && activity.data.data.length > 0 ? (
            <ul className="space-y-1">
              {activity.data.data.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-white/5"
                >
                  <ArrowUpRight size={14} className="mt-1 shrink-0 text-[#3b82f6]" />
                  <div className="min-w-0">
                    <div className="text-sm text-[#dbe6f5]">
                      {titleCase(entry.action)}
                    </div>
                    <div className="font-mono text-[10px] text-[#5f7189]">
                      {entry.entity}
                      {entry.entityId ? ` · ${entry.entityId.slice(0, 8)}` : ""} ·{" "}
                      {relativeTime(entry.createdAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-8 text-center text-sm text-[#7c8fa6]">
              Activity will appear here as you edit content.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}

import {
  ArrowUpRight,
  Download,
  FolderKanban,
  Inbox,
  MessageSquare,
  Plus,
  Upload,
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  useGetActivityQuery,
  useGetConversationsQuery,
  useGetStatsQuery,
} from "../../api/adminApi";
import { PageHeader } from "../../components/PageHeader";
import { ErrorState, LoadingList, Skeleton } from "../../components/States";
import { cn } from "../../lib/cn";
import { formatDate, relativeTime, titleCase } from "../../lib/format";
import "../../style/dashboard.css";

const WEEKS = 20;
/** The heatmap counts the audit-log entries this query returns. Lower it if your API caps pageSize. */
const ACTIVITY_WINDOW = 100;
const LIST_ROWS = 8;

type Cell = { date: Date; count: number; future: boolean; today: boolean };

const dayKey = (date: Date): string =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

const level = (count: number): 0 | 1 | 2 | 3 =>
  count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : 3;

/** One cell per day, oldest first, filled column by column (Sunday to Saturday). */
const buildCells = (timestamps: string[]): Cell[] => {
  const counts = new Map<string, number>();
  for (const iso of timestamps) {
    const key = dayKey(new Date(iso));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay() - (WEEKS - 1) * 7);

  return Array.from({ length: WEEKS * 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      count: counts.get(dayKey(date)) ?? 0,
      future: date > today,
      today: date.getTime() === today.getTime(),
    };
  });
};

const StatCard = ({
  label,
  value,
  suffix,
  hint,
  icon,
  tone,
  hot = false,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  hint?: string;
  icon: React.ReactNode;
  tone?: string;
  hot?: boolean;
}) => (
  <div
    className={cn("db-stat", hot && "hot")}
    style={tone ? ({ "--tone": tone, "--tone-text": tone } as React.CSSProperties) : undefined}
  >
    <span className="db-stat-icon" aria-hidden="true">
      {icon}
    </span>
    <div className="db-stat-body">
      <div className="db-stat-label">{label}</div>
      <div className="db-stat-value">
        {value}
        {suffix ? <small>{suffix}</small> : null}
      </div>
      {hint ? <div className="db-stat-hint">{hint}</div> : null}
    </div>
  </div>
);

export default function DashboardPage() {
  const stats = useGetStatsQuery();
  const conversations = useGetConversationsQuery({ page: 1, pageSize: 5 });
  const activity = useGetActivityQuery({ page: 1, pageSize: ACTIVITY_WINDOW });

  const entries = activity.data?.data ?? [];
  const cells = useMemo(() => buildCells(entries.map((entry) => entry.createdAt)), [entries]);
  const inWindow = cells.reduce((sum, cell) => sum + cell.count, 0);
  const activeDays = cells.filter((cell) => cell.count > 0).length;
  const first = cells[0]?.date;
  const last = cells[cells.length - 1]?.date;
  const shortDate = (date?: Date): string =>
    date ? date.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";

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
        <div className="db-stats">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-[74px]" />
          ))}
        </div>
      ) : stats.error ? (
        <ErrorState error={stats.error} onRetry={stats.refetch} />
      ) : stats.data ? (
        <div className="db-stats">
          <StatCard
            label="Unread chats"
            value={stats.data.conversations.unread}
            hint={`${stats.data.conversations.total} conversations`}
            icon={<Inbox size={18} />}
            hot={stats.data.conversations.unread > 0}
          />
          <StatCard
            label="Open conversations"
            value={stats.data.conversations.open}
            hint={`${stats.data.messages.total} contact-form messages`}
            icon={<MessageSquare size={18} />}
            tone="var(--amb)"
          />
          <StatCard
            label="Projects"
            value={stats.data.projects.published}
            suffix={`/${stats.data.projects.total}`}
            hint={`${stats.data.projects.draft} draft`}
            icon={<FolderKanban size={18} />}
          />
          <StatCard
            label="Resume downloads"
            value={stats.data.resume.downloadCount}
            hint={
              stats.data.resume.available
                ? `Updated ${stats.data.resume.updatedAt ? relativeTime(stats.data.resume.updatedAt) : "—"}`
                : "No resume uploaded"
            }
            icon={<Download size={18} />}
            tone="var(--mid)"
          />
        </div>
      ) : null}

      <div className="db-meta">
        Last content update:{" "}
        <b>
          {stats.data?.lastContentUpdate ? formatDate(stats.data.lastContentUpdate) : "—"}
        </b>
      </div>

      <section className="db-panel" style={{ marginTop: 14 }} aria-label="Activity heatmap">
        <div className="db-head">
          <h2>Activity, last {WEEKS} weeks</h2>
          {activity.data ? (
            <small>
              {inWindow} {inWindow === 1 ? "change" : "changes"} · {activeDays} active{" "}
              {activeDays === 1 ? "day" : "days"}
            </small>
          ) : null}
        </div>
        <div className="db-body">
          {activity.isLoading ? (
            <Skeleton className="h-28" />
          ) : activity.error ? (
            <ErrorState error={activity.error} onRetry={activity.refetch} />
          ) : (
            <div className="db-heat-wrap" style={{ marginTop: 0 }}>
              <div className="db-heat-scroll">
                <div className="db-heat" role="img" aria-label={`${inWindow} changes in the last ${WEEKS} weeks`}>
                  {cells.map((cell) => (
                    <span
                      key={cell.date.getTime()}
                      className={cn(
                        "db-cell",
                        `l${level(cell.count)}`,
                        cell.future && "future",
                        cell.today && "today",
                      )}
                      title={`${cell.date.toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}: ${cell.count} ${cell.count === 1 ? "change" : "changes"}`}
                    />
                  ))}
                </div>
              </div>
              <div className="db-heat-foot">
                <span>
                  {shortDate(first)} – {shortDate(last)}
                </span>
                <span className="db-legend">
                  less <i /> <i className="l1" /> <i className="l2" /> <i className="l3" /> more
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="db-grid">
        <section className="db-panel" aria-label="Latest conversations">
          <div className="db-head">
            <h2>Latest conversations</h2>
            <Link to="/inbox">Open inbox</Link>
          </div>
          {conversations.isLoading ? (
            <div style={{ padding: 12 }}>
              <LoadingList rows={4} />
            </div>
          ) : conversations.error ? (
            <div style={{ padding: 12 }}>
              <ErrorState error={conversations.error} onRetry={conversations.refetch} />
            </div>
          ) : conversations.data && conversations.data.data.length > 0 ? (
            <ul className="db-list">
              {conversations.data.data.map((conversation) => {
                const unread = conversation.unreadForAdmin;
                return (
                  <li key={conversation.id}>
                    <Link to={`/inbox/${conversation.id}`} className="db-row">
                      <span className={cn("db-avatar", unread > 0 && "hot")}>
                        {conversation.visitorName.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="db-main">
                        <span className="db-line">
                          <span className="db-name">{conversation.visitorName}</span>
                          {unread > 0 ? <span className="db-badge">{unread}</span> : null}
                          <span className="db-time">
                            {relativeTime(conversation.lastMessageAt)}
                          </span>
                        </span>
                        <span className="db-sub" style={{ display: "block" }}>
                          {conversation.lastMessagePreview ||
                            conversation.subject ||
                            "No messages yet"}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="db-empty">No conversations yet.</p>
          )}
        </section>

        <section className="db-panel" aria-label="Recent activity">
          <div className="db-head">
            <h2>Recent activity</h2>
          </div>
          {activity.isLoading ? (
            <div style={{ padding: 12 }}>
              <LoadingList rows={5} />
            </div>
          ) : activity.error ? (
            <div style={{ padding: 12 }}>
              <ErrorState error={activity.error} onRetry={activity.refetch} />
            </div>
          ) : entries.length > 0 ? (
            <ul className="db-list">
              {entries.slice(0, LIST_ROWS).map((entry) => (
                <li key={entry.id}>
                  <div className="db-row">
                    <ArrowUpRight size={14} className="db-act-icon" />
                    <div className="db-main">
                      <div className="db-act-title">{titleCase(entry.action)}</div>
                      <div className="db-act-meta">
                        {entry.entity}
                        {entry.entityId ? ` · ${entry.entityId.slice(0, 8)}` : ""} ·{" "}
                        {relativeTime(entry.createdAt)}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="db-empty">Activity will appear here as you edit content.</p>
          )}
        </section>
      </div>
    </>
  );
}
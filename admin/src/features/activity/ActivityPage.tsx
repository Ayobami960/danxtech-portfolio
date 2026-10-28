import { useState } from "react";
import { useGetActivityQuery } from "../../api/adminApi";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import {
  EmptyState,
  ErrorState,
  LoadingList,
  Pagination,
} from "../../components/States";
import { formatDate, shortId, titleCase } from "../../lib/format";

const ENTITIES = [
  "",
  "project",
  "hero",
  "about",
  "credential",
  "skill_group",
  "experience",
  "security_focus",
  "owasp_item",
  "security_stat",
  "settings",
  "resume",
  "conversation",
  "message",
  "admin",
  "session",
  "refresh_token",
];

const PAGE_SIZE = 20;

export default function ActivityPage() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState("");
  const query = useGetActivityQuery({
    page,
    pageSize: PAGE_SIZE,
    ...(entity ? { entity } : {}),
  });

  return (
    <>
      <PageHeader
        eyebrow="System"
        title="Activity"
        description="Every mutation is recorded here — content, logins, 2FA, sessions and invites. Message bodies are never logged."
        actions={
          <div>
            <label className="sr-only" htmlFor="entity-filter">
              Filter by entity
            </label>
            <select
              id="entity-filter"
              className="field min-w-[180px]"
              value={entity}
              onChange={(event) => {
                setEntity(event.target.value);
                setPage(1);
              }}
            >
              {ENTITIES.map((value) => (
                <option key={value || "all"} value={value}>
                  {value ? titleCase(value) : "All entities"}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {query.isLoading ? (
        <LoadingList rows={8} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data && query.data.data.length > 0 ? (
        <>
          <Card bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/5 font-mono text-[10px] uppercase tracking-wide text-[#5f7189]">
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entity</th>
                    <th className="hidden px-4 py-3 sm:table-cell">Actor</th>
                    <th className="px-4 py-3 text-right">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {query.data.data.map((entry) => (
                    <tr key={entry.id} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#dbe6f5]">
                          {titleCase(entry.action)}
                        </div>
                        {entry.meta && Object.keys(entry.meta).length > 0 ? (
                          <div className="mt-0.5 font-mono text-[10px] text-[#5f7189]">
                            {Object.keys(entry.meta).join(", ")}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[10px] text-[#9db0c6]">
                          {entry.entity}
                        </span>
                        {entry.entityId ? (
                          <span className="ml-1 font-mono text-[10px] text-[#5f7189]">
                            · {shortId(entry.entityId)}
                          </span>
                        ) : null}
                      </td>
                      <td className="hidden px-4 py-3 font-mono text-[11px] text-[#7c8fa6] sm:table-cell">
                        {entry.userEmail ?? "system"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-[11px] text-[#7c8fa6]">
                        {formatDate(entry.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={query.data.meta.total}
            onPage={setPage}
          />
        </>
      ) : (
        <EmptyState
          title="No activity for this filter"
          description="Actions you take in the admin appear here, newest first."
        />
      )}
    </>
  );
}

import { zodResolver } from "@hookform/resolvers/zod";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import {
  useCreateOwaspMutation,
  useCreateSecurityFocusMutation,
  useCreateSecurityStatMutation,
  useDeleteOwaspMutation,
  useDeleteSecurityFocusMutation,
  useDeleteSecurityStatMutation,
  useGetOwaspQuery,
  useGetSecurityFocusQuery,
  useGetSecurityStatsQuery,
  useReorderOwaspMutation,
  useReorderSecurityFocusMutation,
  useReorderSecurityStatsMutation,
  useUpdateOwaspMutation,
  useUpdateSecurityFocusMutation,
  useUpdateSecurityStatMutation,
} from "../../api/adminApi";
import { errorMessage } from "../../api/errors";
import type { OwaspItem, SecurityFocus, SecurityStat } from "../../api/types";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ColorField, EmojiField, TagInput, Toggle } from "../../components/Fields";
import { FormDialog } from "../../components/FormDialog";
import { PageHeader } from "../../components/PageHeader";
import { EmptyState, ErrorState, LoadingList } from "../../components/States";
import { cn } from "../../lib/cn";
import { focusSchema, owaspSchema, securityStatSchema } from "../../lib/schemas";

import "../../style/security.css";

type Tab = "focus" | "owasp" | "stats";

const TAB_IDS: Tab[] = ["focus", "owasp", "stats"];
const COLLAPSED_SKILLS = 4;

/* -------------------------------- reorder list ------------------------------- */

/**
 * A reorderable list. Shows the new order instantly (`local`), saves it, then refetches the
 * server list and drops `local`. Rows drag with the mouse, or with the arrow keys on the handle.
 */
function ReorderList<T extends { id: string }>({
  items,
  save,
  refetch,
  labelOf,
  renderRow,
}: {
  items: T[];
  save: (ids: string[]) => Promise<unknown>;
  refetch: () => Promise<unknown>;
  labelOf: (item: T) => string;
  renderRow: (item: T) => ReactNode;
}) {
  const [local, setLocal] = useState<T[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const gripRefs = useRef(new Map<string, HTMLButtonElement>());
  const list = local ?? items;

  const commit = async (next: T[], focusId?: string): Promise<void> => {
    setLocal(next);
    setBusy(true);
    try {
      await save(next.map((item) => item.id));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      try {
        await refetch();
      } finally {
        setLocal(null);
        setBusy(false);
        if (focusId) requestAnimationFrame(() => gripRefs.current.get(focusId)?.focus());
      }
    }
  };

  const moveTo = (fromId: string, toIndex: number): void => {
    const fromIndex = list.findIndex((item) => item.id === fromId);
    if (fromIndex < 0 || toIndex < 0 || toIndex >= list.length || fromIndex === toIndex) return;
    const next = [...list];
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) return;
    next.splice(toIndex, 0, moved);
    void commit(next, fromId);
  };

  const endDrag = (): void => {
    setDragId(null);
    setTargetId(null);
  };

  const onGripKey = (event: KeyboardEvent, id: string, index: number): void => {
    const step =
      event.key === "ArrowUp" || event.key === "ArrowLeft"
        ? -1
        : event.key === "ArrowDown" || event.key === "ArrowRight"
          ? 1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    moveTo(id, index + step);
  };

  return (
    <div className={cn("sc-list", busy && "sc-busy")} aria-busy={busy}>
      {list.map((item, index) => (
        <div
          key={item.id}
          className={cn(
            "sc-row",
            dragId === item.id && "drag",
            targetId === item.id && dragId !== item.id && "target",
          )}
          draggable={!busy}
          onDragStart={(event) => {
            setDragId(item.id);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", item.id);
          }}
          onDragEnd={endDrag}
          onDragOver={(event) => {
            if (!dragId) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setTargetId(item.id);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setTargetId((current) => (current === item.id ? null : current));
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            const from = dragId;
            endDrag();
            if (from && from !== item.id) moveTo(from, index);
          }}
        >
          <button
            type="button"
            className="sc-grip"
            ref={(node) => {
              if (node) gripRefs.current.set(item.id, node);
              else gripRefs.current.delete(item.id);
            }}
            aria-label={`Reorder ${labelOf(item)}. Position ${index + 1} of ${list.length}. Use the arrow keys to move.`}
            disabled={busy}
            onKeyDown={(event) => onGripKey(event, item.id, index)}
          >
            <GripVertical />
          </button>
          <div className="sc-content">{renderRow(item)}</div>
        </div>
      ))}
    </div>
  );
}

const RowActions = ({
  name,
  onEdit,
  onDelete,
}: {
  name: string;
  onEdit: () => void;
  onDelete: () => void;
}) => (
  <div className="sc-act">
    <button type="button" className="ib" aria-label={`Edit ${name}`} onClick={onEdit}>
      <Pencil />
    </button>
    <button type="button" className="ib d" aria-label={`Delete ${name}`} onClick={onDelete}>
      <Trash2 />
    </button>
  </div>
);

/* ---------------------------------- focus ---------------------------------- */

type FocusForm = z.infer<typeof focusSchema>;

const FocusDialog = ({
  entry,
  onClose,
  onSaved,
}: {
  entry: SecurityFocus | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [create, createState] = useCreateSecurityFocusMutation();
  const [update, updateState] = useUpdateSecurityFocusMutation();
  const form = useForm<FocusForm>({
    resolver: zodResolver(focusSchema),
    defaultValues: entry
      ? {
          title: entry.title,
          icon: entry.icon,
          color: entry.color,
          description: entry.description,
          skills: entry.skills,
        }
      : { title: "", icon: "🛡️", color: "#3b82f6", description: "", skills: [] },
  });
  const watched = form.watch();
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (entry) {
        await update({ id: entry.id, patch: values }).unwrap();
        toast.success("Focus area updated");
      } else {
        await create(values).unwrap();
        toast.success("Focus area added");
      }
      onSaved();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Could not save the focus area."));
    }
  });

  return (
    <FormDialog
      open
      title={entry ? "Edit focus area" : "New focus area"}
      onClose={onClose}
      onSubmit={() => void onSubmit()}
      busy={createState.isLoading || updateState.isLoading}
    >
      <div className="sc-grid2">
        <div>
          <label className="label" htmlFor="focus-title">
            Title
          </label>
          <input
            id="focus-title"
            className={cn("field", errors.title && "is-invalid")}
            maxLength={120}
            {...form.register("title")}
          />
          {errors.title?.message ? <p className="field-error">{errors.title.message}</p> : null}
        </div>
        <div>
          <span className="label">Colour</span>
          <ColorField
            value={watched.color}
            onChange={(value) => form.setValue("color", value, { shouldDirty: true })}
          />
          {errors.color?.message ? <p className="field-error">{errors.color.message}</p> : null}
        </div>
      </div>
      <div>
        <span className="label">Icon</span>
        <EmojiField
          value={watched.icon}
          onChange={(value) => form.setValue("icon", value, { shouldDirty: true })}
        />
      </div>
      <div>
        <label className="label" htmlFor="focus-description">
          Description · {watched.description.length}/400
        </label>
        <textarea
          id="focus-description"
          className={cn("field min-h-24", errors.description && "is-invalid")}
          maxLength={400}
          {...form.register("description")}
        />
        {errors.description?.message ? (
          <p className="field-error">{errors.description.message}</p>
        ) : null}
      </div>
      <div>
        <span className="label">
          Skills · {watched.skills.length}/12
        </span>
        <TagInput
          value={watched.skills}
          max={12}
          maxLength={60}
          onChange={(value) => form.setValue("skills", value, { shouldDirty: true })}
        />
      </div>
    </FormDialog>
  );
};

/* ---------------------------------- OWASP ---------------------------------- */

type OwaspForm = z.infer<typeof owaspSchema>;

const OwaspDialog = ({
  entry,
  onClose,
  onSaved,
}: {
  entry: OwaspItem | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [create, createState] = useCreateOwaspMutation();
  const [update, updateState] = useUpdateOwaspMutation();
  const form = useForm<OwaspForm>({
    resolver: zodResolver(owaspSchema),
    defaultValues: entry
      ? { code: entry.code, name: entry.name, covered: entry.covered }
      : { code: "A01", name: "", covered: false },
  });
  const watched = form.watch();
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (entry) {
        await update({ id: entry.id, patch: values }).unwrap();
        toast.success("OWASP item updated");
      } else {
        await create(values).unwrap();
        toast.success("OWASP item added");
      }
      onSaved();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Could not save the OWASP item."));
    }
  });

  return (
    <FormDialog
      open
      title={entry ? "Edit OWASP item" : "New OWASP item"}
      onClose={onClose}
      onSubmit={() => void onSubmit()}
      busy={createState.isLoading || updateState.isLoading}
    >
      <div className="sc-grid-code">
        <div>
          <label className="label" htmlFor="owasp-code">
            Code
          </label>
          <input
            id="owasp-code"
            className={cn("field font-mono", errors.code && "is-invalid")}
            maxLength={3}
            placeholder="A01"
            {...form.register("code")}
          />
          {errors.code?.message ? <p className="field-error">{errors.code.message}</p> : null}
        </div>
        <div>
          <label className="label" htmlFor="owasp-name">
            Name
          </label>
          <input
            id="owasp-name"
            className={cn("field", errors.name && "is-invalid")}
            maxLength={120}
            {...form.register("name")}
          />
          {errors.name?.message ? <p className="field-error">{errors.name.message}</p> : null}
        </div>
      </div>
      <label className="sc-cov-field">
        <Toggle
          checked={watched.covered}
          onChange={(value) => form.setValue("covered", value, { shouldDirty: true })}
          label="Covered"
        />
        Covered in your work
      </label>
    </FormDialog>
  );
};

/* ---------------------------------- stats ---------------------------------- */

type StatForm = z.infer<typeof securityStatSchema>;

const StatDialog = ({
  entry,
  onClose,
  onSaved,
}: {
  entry: SecurityStat | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [create, createState] = useCreateSecurityStatMutation();
  const [update, updateState] = useUpdateSecurityStatMutation();
  const form = useForm<StatForm>({
    resolver: zodResolver(securityStatSchema),
    defaultValues: entry
      ? { icon: entry.icon, label: entry.label, value: entry.value }
      : { icon: "🔐", label: "", value: "" },
  });
  const watched = form.watch();
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (entry) {
        await update({ id: entry.id, patch: values }).unwrap();
        toast.success("Security stat updated");
      } else {
        await create(values).unwrap();
        toast.success("Security stat added");
      }
      onSaved();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Could not save the security stat."));
    }
  });

  return (
    <FormDialog
      open
      title={entry ? "Edit stat" : "New stat"}
      onClose={onClose}
      onSubmit={() => void onSubmit()}
      busy={createState.isLoading || updateState.isLoading}
    >
      <div>
        <span className="label">Icon</span>
        <EmojiField
          value={watched.icon}
          onChange={(value) => form.setValue("icon", value, { shouldDirty: true })}
        />
      </div>
      <div className="sc-grid2">
        <div>
          <label className="label" htmlFor="stat-value">
            Value
          </label>
          <input
            id="stat-value"
            className={cn("field", errors.value && "is-invalid")}
            maxLength={20}
            {...form.register("value")}
          />
          {errors.value?.message ? <p className="field-error">{errors.value.message}</p> : null}
        </div>
        <div>
          <label className="label" htmlFor="stat-label">
            Label
          </label>
          <input
            id="stat-label"
            className={cn("field", errors.label && "is-invalid")}
            maxLength={60}
            {...form.register("label")}
          />
          {errors.label?.message ? <p className="field-error">{errors.label.message}</p> : null}
        </div>
      </div>
    </FormDialog>
  );
};

/* ----------------------------------- page ---------------------------------- */

export default function SecurityPage() {
  const [tab, setTab] = useState<Tab>("focus");
  // Same arguments as the tabs below, so RTK Query shares one cached request per list.
  const focus = useGetSecurityFocusQuery({ page: 1, pageSize: 100 });
  const owasp = useGetOwaspQuery({ page: 1, pageSize: 100 });
  const stats = useGetSecurityStatsQuery({ page: 1, pageSize: 100 });

  const focusCount = focus.data?.data.length;
  const owaspAll = owasp.data?.data ?? [];
  const covered = owaspAll.filter((item) => item.covered).length;
  const coveredPct = owaspAll.length > 0 ? Math.round((covered / owaspAll.length) * 100) : 0;
  const statsCount = stats.data?.data.length;

  const counts: Record<Tab, number | undefined> = {
    focus: focusCount,
    owasp: owasp.data ? owaspAll.length : undefined,
    stats: statsCount,
  };
  const labels: Record<Tab, string> = { focus: "Focus areas", owasp: "OWASP", stats: "Stats" };

  const onTabKey = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = TAB_IDS[(TAB_IDS.indexOf(tab) + step + TAB_IDS.length) % TAB_IDS.length];
    if (!next) return;
    setTab(next);
    requestAnimationFrame(() => document.getElementById(`security-tab-${next}`)?.focus());
  };

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Security"
        description="Focus areas, OWASP coverage and the security stats shown on the public site."
      />

      <div className="sc-summary">
        <button
          type="button"
          className={cn("sc-tile", tab === "focus" && "on")}
          onClick={() => setTab("focus")}
        >
          <small>Focus areas</small>
          <div className="sc-num">{focusCount ?? "—"}</div>
        </button>
        <button
          type="button"
          className={cn("sc-tile", tab === "owasp" && "on")}
          onClick={() => setTab("owasp")}
        >
          <small>OWASP covered</small>
          <div className="sc-num">
            {owasp.data ? covered : "—"}
            {owasp.data ? <em>/{owaspAll.length}</em> : null}
          </div>
          <div
            className="sc-bar"
            role="progressbar"
            aria-label="OWASP coverage"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={coveredPct}
          >
            <i style={{ width: `${coveredPct}%` }} />
          </div>
        </button>
        <button
          type="button"
          className={cn("sc-tile", tab === "stats" && "on")}
          onClick={() => setTab("stats")}
        >
          <small>Stats shown</small>
          <div className="sc-num">{statsCount ?? "—"}</div>
        </button>
      </div>

      <div role="tablist" aria-label="Security content" className="sc-tabs" onKeyDown={onTabKey}>
        {TAB_IDS.map((id) => (
          <button
            key={id}
            id={`security-tab-${id}`}
            type="button"
            role="tab"
            className="sc-tab"
            aria-selected={tab === id}
            aria-controls="security-panel"
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
          >
            {labels[id]}
            {counts[id] !== undefined ? <span>{counts[id]}</span> : null}
          </button>
        ))}
      </div>

      <div id="security-panel" role="tabpanel" aria-labelledby={`security-tab-${tab}`}>
        {tab === "focus" ? <FocusTab /> : null}
        {tab === "owasp" ? <OwaspTab /> : null}
        {tab === "stats" ? <StatsTab /> : null}
      </div>
    </>
  );
}

const FocusTab = () => {
  const query = useGetSecurityFocusQuery({ page: 1, pageSize: 100 });
  const [reorder] = useReorderSecurityFocusMutation();
  const [remove, removeState] = useDeleteSecurityFocusMutation();
  const [editing, setEditing] = useState<SecurityFocus | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<SecurityFocus | null>(null);

  return (
    <>
      {query.isLoading ? (
        <LoadingList rows={4} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data && query.data.data.length > 0 ? (
        <>
          <ReorderList
            items={query.data.data}
            save={(ids) => reorder(ids).unwrap()}
            refetch={() => query.refetch()}
            labelOf={(entry) => entry.title}
            renderRow={(entry) => {
              const shown = entry.skills.slice(0, COLLAPSED_SKILLS);
              const hidden = entry.skills.length - shown.length;
              return (
                <>
                  <span
                    className="sc-ico"
                    style={{ "--c": entry.color } as React.CSSProperties}
                    aria-hidden="true"
                  >
                    {entry.icon}
                  </span>
                  <div className="sc-body" style={{ "--c": entry.color } as React.CSSProperties}>
                    <div className="sc-title">{entry.title}</div>
                    {entry.description ? <p className="sc-desc">{entry.description}</p> : null}
                    <div className="sc-chips">
                      {entry.skills.length === 0 ? (
                        <span className="sc-chip more">No skills</span>
                      ) : (
                        <>
                          {shown.map((skill) => (
                            <span key={skill} className="sc-chip">
                              {skill}
                            </span>
                          ))}
                          {hidden > 0 ? <span className="sc-chip more">+{hidden}</span> : null}
                        </>
                      )}
                    </div>
                  </div>
                  <RowActions
                    name={entry.title}
                    onEdit={() => setEditing(entry)}
                    onDelete={() => setDeleting(entry)}
                  />
                </>
              );
            }}
          />
          <button type="button" className="sc-add" onClick={() => setCreating(true)}>
            <Plus size={15} /> New focus area
          </button>
        </>
      ) : (
        <EmptyState
          title="No focus areas yet"
          description="Add the security disciplines you work in."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              New focus area
            </button>
          }
        />
      )}

      {creating ? (
        <FocusDialog entry={null} onClose={() => setCreating(false)} onSaved={() => void query.refetch()} />
      ) : null}
      {editing ? (
        <FocusDialog entry={editing} onClose={() => setEditing(null)} onSaved={() => void query.refetch()} />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete “${deleting?.title ?? ""}”?`}
        description="This focus area is removed from the public site."
        busy={removeState.isLoading}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          void remove(deleting.id)
            .unwrap()
            .then(() => {
              toast.success("Focus area deleted");
              setDeleting(null);
            })
            .catch((error: unknown) => toast.error(errorMessage(error)));
        }}
      />
    </>
  );
};

const OwaspTab = () => {
  const query = useGetOwaspQuery({ page: 1, pageSize: 100 });
  const [reorder] = useReorderOwaspMutation();
  const [update] = useUpdateOwaspMutation();
  const [remove, removeState] = useDeleteOwaspMutation();
  const [editing, setEditing] = useState<OwaspItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<OwaspItem | null>(null);

  const toggleCovered = (entry: OwaspItem, covered: boolean): void => {
    void update({ id: entry.id, patch: { covered } })
      .unwrap()
      .catch((error: unknown) => toast.error(errorMessage(error)));
  };

  return (
    <>
      {query.isLoading ? (
        <LoadingList rows={4} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data && query.data.data.length > 0 ? (
        <>
          <ReorderList
            items={query.data.data}
            save={(ids) => reorder(ids).unwrap()}
            refetch={() => query.refetch()}
            labelOf={(entry) => `${entry.code} ${entry.name}`}
            renderRow={(entry) => (
              <>
                <span className={cn("sc-code", entry.covered && "on")}>{entry.code}</span>
                <div className="sc-body">
                  <div className="sc-title">{entry.name}</div>
                </div>
                <label className="sc-cov">
                  <Toggle
                    checked={entry.covered}
                    onChange={(value) => toggleCovered(entry, value)}
                    label={`Covered: ${entry.name}`}
                  />
                  <span>{entry.covered ? "Covered" : "Not covered"}</span>
                </label>
                <RowActions
                  name={entry.name}
                  onEdit={() => setEditing(entry)}
                  onDelete={() => setDeleting(entry)}
                />
              </>
            )}
          />
          <button type="button" className="sc-add" onClick={() => setCreating(true)}>
            <Plus size={15} /> New item
          </button>
        </>
      ) : (
        <EmptyState
          title="No OWASP items yet"
          description="Track the OWASP Top 10 and which items your work covers."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              New item
            </button>
          }
        />
      )}

      {creating ? (
        <OwaspDialog entry={null} onClose={() => setCreating(false)} onSaved={() => void query.refetch()} />
      ) : null}
      {editing ? (
        <OwaspDialog entry={editing} onClose={() => setEditing(null)} onSaved={() => void query.refetch()} />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete “${deleting?.code ?? ""}”?`}
        description="This item is removed from the public security section."
        busy={removeState.isLoading}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          void remove(deleting.id)
            .unwrap()
            .then(() => {
              toast.success("OWASP item deleted");
              setDeleting(null);
            })
            .catch((error: unknown) => toast.error(errorMessage(error)));
        }}
      />
    </>
  );
};

const StatsTab = () => {
  const query = useGetSecurityStatsQuery({ page: 1, pageSize: 100 });
  const [reorder] = useReorderSecurityStatsMutation();
  const [remove, removeState] = useDeleteSecurityStatMutation();
  const [editing, setEditing] = useState<SecurityStat | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<SecurityStat | null>(null);

  return (
    <>
      {query.isLoading ? (
        <LoadingList rows={4} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data && query.data.data.length > 0 ? (
        <>
          <ReorderList
            items={query.data.data}
            save={(ids) => reorder(ids).unwrap()}
            refetch={() => query.refetch()}
            labelOf={(entry) => entry.label}
            renderRow={(entry) => (
              <>
                <span className="sc-stat-ico" aria-hidden="true">
                  {entry.icon}
                </span>
                <div className="sc-body">
                  <span className="sc-stat-val">{entry.value}</span>
                  <span className="sc-title" style={{ fontWeight: 400 }}>
                    {entry.label}
                  </span>
                </div>
                <RowActions
                  name={entry.label}
                  onEdit={() => setEditing(entry)}
                  onDelete={() => setDeleting(entry)}
                />
              </>
            )}
          />
          <button type="button" className="sc-add" onClick={() => setCreating(true)}>
            <Plus size={15} /> New stat
          </button>
        </>
      ) : (
        <EmptyState
          title="No stats yet"
          description="Add headline security numbers, like incident-free releases."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              New stat
            </button>
          }
        />
      )}

      {creating ? (
        <StatDialog entry={null} onClose={() => setCreating(false)} onSaved={() => void query.refetch()} />
      ) : null}
      {editing ? (
        <StatDialog entry={editing} onClose={() => setEditing(null)} onSaved={() => void query.refetch()} />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete “${deleting?.label ?? ""}”?`}
        description="This stat is removed from the public security section."
        busy={removeState.isLoading}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          void remove(deleting.id)
            .unwrap()
            .then(() => {
              toast.success("Stat deleted");
              setDeleting(null);
            })
            .catch((error: unknown) => toast.error(errorMessage(error)));
        }}
      />
    </>
  );
};
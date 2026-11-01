import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
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
import type { OwaspItem, SecurityFocus, SecurityStat } from "../../api/types";
import { errorMessage } from "../../api/errors";
import { Card } from "../../components/Card";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ColorField, EmojiField, TagInput, Toggle } from "../../components/Fields";
import { FormDialog } from "../../components/FormDialog";
import { PageHeader } from "../../components/PageHeader";
import { SortableList } from "../../components/SortableList";
import { EmptyState, ErrorState, LoadingList } from "../../components/States";
import {
  focusSchema,
  owaspSchema,
  securityStatSchema,
} from "../../lib/schemas";
import type { z } from "zod";

type Tab = "focus" | "owasp" | "stats";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "focus", label: "Focus areas" },
  { id: "owasp", label: "OWASP" },
  { id: "stats", label: "Stats" },
];

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
      : {
          title: "",
          icon: "🛡️",
          color: "#3b82f6",
          description: "",
          skills: [],
        },
  });
  const watched = form.watch();

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
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="focus-title">
            Title
          </label>
          <input id="focus-title" className="field" maxLength={120} {...form.register("title")} />
        </div>
        <div>
          <label className="label" htmlFor="focus-color">
            Colour
          </label>
          <ColorField
            value={watched.color}
            onChange={(value) => form.setValue("color", value, { shouldDirty: true })}
          />
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
          className="field min-h-24"
          maxLength={400}
          {...form.register("description")}
        />
      </div>
      <div>
        <span className="label">Skills · max 12</span>
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
      <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
        <div>
          <label className="label" htmlFor="owasp-code">
            Code
          </label>
          <input
            id="owasp-code"
            className="field font-mono"
            maxLength={3}
            placeholder="A01"
            {...form.register("code")}
          />
        </div>
        <div>
          <label className="label" htmlFor="owasp-name">
            Name
          </label>
          <input id="owasp-name" className="field" maxLength={120} {...form.register("name")} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-[#cbd8e8]">
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
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="stat-value">
            Value
          </label>
          <input id="stat-value" className="field" maxLength={20} {...form.register("value")} />
        </div>
        <div>
          <label className="label" htmlFor="stat-label">
            Label
          </label>
          <input id="stat-label" className="field" maxLength={60} {...form.register("label")} />
        </div>
      </div>
    </FormDialog>
  );
};

/* ----------------------------------- page ---------------------------------- */

export default function SecurityPage() {
  const [tab, setTab] = useState<Tab>("focus");

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Security"
        description="Focus areas, OWASP coverage and the security stats shown on the public site."
      />

      <div role="tablist" aria-label="Security content" className="mb-4 flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={
              tab === item.id
                ? "btn btn-primary"
                : "btn btn-ghost"
            }
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "focus" ? <FocusTab /> : null}
      {tab === "owasp" ? <OwaspTab /> : null}
      {tab === "stats" ? <StatsTab /> : null}
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
      <div className="mb-3 flex justify-end">
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          <Plus size={15} /> New focus area
        </button>
      </div>
      {query.isLoading ? (
        <LoadingList rows={4} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data && query.data.data.length > 0 ? (
        <Card bodyClassName="p-3">
          <SortableList
            items={query.data.data.map((entry) => ({
              id: entry.id,
              node: (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-lg">{entry.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white">{entry.title}</div>
                    <div className="truncate font-mono text-[10px] text-[#5f7189]">
                      {entry.skills.join(" · ") || "No skills"}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-[#7c8fa6] hover:bg-white/5 hover:text-white"
                    aria-label={`Edit ${entry.title}`}
                    onClick={() => setEditing(entry)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-[#7c8fa6] hover:bg-red-500/10 hover:text-red-300"
                    aria-label={`Delete ${entry.title}`}
                    onClick={() => setDeleting(entry)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ),
            }))}
            onReorder={(ids) => {
              void reorder(ids)
                .unwrap()
                .catch((error: unknown) => toast.error(errorMessage(error)));
            }}
          />
        </Card>
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
      <div className="mb-3 flex justify-end">
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          <Plus size={15} /> New item
        </button>
      </div>
      {query.isLoading ? (
        <LoadingList rows={4} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data && query.data.data.length > 0 ? (
        <Card bodyClassName="p-3">
          <SortableList
            items={query.data.data.map((entry) => ({
              id: entry.id,
              node: (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded border border-white/10 px-2 py-0.5 font-mono text-[10px] text-[#f0a500]">
                    {entry.code}
                  </span>
                  <div className="min-w-0 flex-1 truncate text-sm text-white">{entry.name}</div>
                  <label className="flex items-center gap-2 text-[11px] text-[#7c8fa6]">
                    <Toggle
                      checked={entry.covered}
                      onChange={(value) => toggleCovered(entry, value)}
                      label={`Covered: ${entry.name}`}
                    />
                    {entry.covered ? "Covered" : "Not covered"}
                  </label>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-[#7c8fa6] hover:bg-white/5 hover:text-white"
                    aria-label={`Edit ${entry.name}`}
                    onClick={() => setEditing(entry)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-[#7c8fa6] hover:bg-red-500/10 hover:text-red-300"
                    aria-label={`Delete ${entry.name}`}
                    onClick={() => setDeleting(entry)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ),
            }))}
            onReorder={(ids) => {
              void reorder(ids)
                .unwrap()
                .catch((error: unknown) => toast.error(errorMessage(error)));
            }}
          />
        </Card>
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
      <div className="mb-3 flex justify-end">
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          <Plus size={15} /> New stat
        </button>
      </div>
      {query.isLoading ? (
        <LoadingList rows={4} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data && query.data.data.length > 0 ? (
        <Card bodyClassName="p-3">
          <SortableList
            items={query.data.data.map((entry) => ({
              id: entry.id,
              node: (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-lg">{entry.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white">
                      <span className="font-grotesk font-semibold">{entry.value}</span>{" "}
                      {entry.label}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-[#7c8fa6] hover:bg-white/5 hover:text-white"
                    aria-label={`Edit ${entry.label}`}
                    onClick={() => setEditing(entry)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-[#7c8fa6] hover:bg-red-500/10 hover:text-red-300"
                    aria-label={`Delete ${entry.label}`}
                    onClick={() => setDeleting(entry)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ),
            }))}
            onReorder={(ids) => {
              void reorder(ids)
                .unwrap()
                .catch((error: unknown) => toast.error(errorMessage(error)));
            }}
          />
        </Card>
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

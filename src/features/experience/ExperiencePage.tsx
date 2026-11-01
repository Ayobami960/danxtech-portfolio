import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  useCreateExperienceMutation,
  useDeleteExperienceMutation,
  useGetExperienceQuery,
  useReorderExperienceMutation,
  useUpdateExperienceMutation,
} from "../../api/adminApi";
import type { Experience } from "../../api/types";
import { errorMessage } from "../../api/errors";
import { Card } from "../../components/Card";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ColorField, Toggle } from "../../components/Fields";
import { FormDialog } from "../../components/FormDialog";
import { PageHeader } from "../../components/PageHeader";
import { SortableList } from "../../components/SortableList";
import { EmptyState, ErrorState, LoadingList } from "../../components/States";
import { experienceSchema } from "../../lib/schemas";
import type { z } from "zod";

type Form = z.infer<typeof experienceSchema>;

const BLANK: Form = {
  type: "engineering",
  role: "",
  company: "",
  period: "",
  isCurrent: false,
  color: "#3b82f6",
  highlights: [],
};

const toForm = (entry: Experience): Form => ({
  type: entry.type,
  role: entry.role,
  company: entry.company,
  period: entry.period,
  isCurrent: entry.isCurrent,
  color: entry.color,
  highlights: entry.highlights,
});

const ExperienceDialog = ({
  entry,
  onClose,
  onSaved,
}: {
  entry: Experience | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [create, createState] = useCreateExperienceMutation();
  const [update, updateState] = useUpdateExperienceMutation();
  const [highlight, setHighlight] = useState("");
  const form = useForm<Form>({
    resolver: zodResolver(experienceSchema),
    defaultValues: entry ? toForm(entry) : BLANK,
  });
  const watched = form.watch();

  const addHighlight = (): void => {
    const value = highlight.trim();
    if (!value || watched.highlights.length >= 12) return;
    form.setValue("highlights", [...watched.highlights, value], {
      shouldDirty: true,
    });
    setHighlight("");
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (entry) {
        await update({ id: entry.id, patch: values }).unwrap();
        toast.success("Experience updated");
      } else {
        await create(values).unwrap();
        toast.success("Experience added");
      }
      onSaved();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Could not save the experience entry."));
    }
  });

  return (
    <FormDialog
      open
      title={entry ? "Edit experience" : "New experience"}
      onClose={onClose}
      onSubmit={() => void onSubmit()}
      busy={createState.isLoading || updateState.isLoading}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="type">
            Type
          </label>
          <select id="type" className="field" {...form.register("type")}>
            <option value="engineering">Engineering</option>
            <option value="security">Security</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="period">
            Period
          </label>
          <input
            id="period"
            className="field"
            maxLength={60}
            placeholder="2023 — Present"
            {...form.register("period")}
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="role">
          Role
        </label>
        <input id="role" className="field" maxLength={120} {...form.register("role")} />
      </div>
      <div>
        <label className="label" htmlFor="company">
          Company
        </label>
        <input id="company" className="field" maxLength={120} {...form.register("company")} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className="label">Accent colour</span>
          <ColorField
            value={watched.color}
            onChange={(value) => form.setValue("color", value, { shouldDirty: true })}
          />
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-[#cbd8e8]">
          <Toggle
            checked={watched.isCurrent}
            onChange={(value) => form.setValue("isCurrent", value, { shouldDirty: true })}
            label="Current role"
          />
          Current role
        </label>
      </div>
      <div>
        <span className="label">Highlights · max 12</span>
        <div className="space-y-1.5">
          {watched.highlights.map((item, index) => (
            <div
              key={`${item}-${index}`}
              className="flex items-start gap-2 rounded-lg border border-white/10 px-2 py-1.5"
            >
              <p className="min-w-0 flex-1 text-xs text-[#cbd8e8]">{item}</p>
              <button
                type="button"
                className="text-[#7c8fa6] hover:text-red-300"
                aria-label="Remove highlight"
                onClick={() =>
                  form.setValue(
                    "highlights",
                    watched.highlights.filter((_, position) => position !== index),
                    { shouldDirty: true },
                  )
                }
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              className="field"
              maxLength={300}
              placeholder="Describe an outcome"
              value={highlight}
              onChange={(event) => setHighlight(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addHighlight();
                }
              }}
            />
            <button type="button" className="btn btn-ghost" onClick={addHighlight}>
              Add
            </button>
          </div>
        </div>
      </div>
    </FormDialog>
  );
};

export default function ExperiencePage() {
  const query = useGetExperienceQuery({ page: 1, pageSize: 100 });
  const [reorder] = useReorderExperienceMutation();
  const [remove, removeState] = useDeleteExperienceMutation();
  const [editing, setEditing] = useState<Experience | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Experience | null>(null);

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Experience"
        description="Roles shown on the timeline. Drag to reorder; education lives under Credentials."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={15} /> New experience
          </button>
        }
      />

      {query.isLoading ? (
        <LoadingList rows={5} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data && query.data.data.length > 0 ? (
        <Card bodyClassName="p-3">
          <SortableList
            items={query.data.data.map((entry) => ({
              id: entry.id,
              node: (
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="h-9 w-1 shrink-0 rounded-full"
                    style={{ background: entry.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-white">
                        {entry.role}
                      </span>
                      <span className="rounded-full border border-white/10 px-1.5 py-0.5 font-mono text-[9px] uppercase text-[#9db0c6]">
                        {entry.type}
                      </span>
                      {entry.isCurrent ? (
                        <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase text-emerald-300">
                          current
                        </span>
                      ) : null}
                    </div>
                    <div className="font-mono text-[10px] text-[#5f7189]">
                      {entry.company} · {entry.period} · {entry.highlights.length} highlight(s)
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-[#7c8fa6] hover:bg-white/5 hover:text-white"
                    aria-label={`Edit ${entry.role}`}
                    onClick={() => setEditing(entry)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-[#7c8fa6] hover:bg-red-500/10 hover:text-red-300"
                    aria-label={`Delete ${entry.role}`}
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
          title="No experience yet"
          description="Add your first role — it appears on the public timeline within a minute."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              New experience
            </button>
          }
        />
      )}

      {creating ? (
        <ExperienceDialog
          entry={null}
          onClose={() => setCreating(false)}
          onSaved={() => void query.refetch()}
        />
      ) : null}
      {editing ? (
        <ExperienceDialog
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={() => void query.refetch()}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete “${deleting?.role ?? ""}”?`}
        description="This removes the entry from the public timeline."
        busy={removeState.isLoading}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          void remove(deleting.id)
            .unwrap()
            .then(() => {
              toast.success("Experience deleted");
              setDeleting(null);
            })
            .catch((error: unknown) => toast.error(errorMessage(error)));
        }}
      />
    </>
  );
}

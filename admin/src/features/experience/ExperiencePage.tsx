import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import {
  useCreateExperienceMutation,
  useDeleteExperienceMutation,
  useGetExperienceQuery,
  useReorderExperienceMutation,
  useUpdateExperienceMutation,
} from "../../api/adminApi";
import { errorMessage } from "../../api/errors";
import type { Experience } from "../../api/types";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ColorField, Toggle } from "../../components/Fields";
import { FormDialog } from "../../components/FormDialog";
import { PageHeader } from "../../components/PageHeader";
import { SortableList } from "../../components/SortableList";
import { EmptyState, ErrorState, LoadingList } from "../../components/States";
import { cn } from "../../lib/cn";
import { experienceSchema } from "../../lib/schemas";
import "../../style/experience.css";

type Form = z.infer<typeof experienceSchema>;

const PREVIEW_HIGHLIGHTS = 4;

const BLANK: Form = {
  type: "engineering",
  role: "",
  company: "",
  period: "",
  isCurrent: false,
  color: "#0b8f7b",
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
  const errors = form.formState.errors;

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
      <div className="ex-grid2">
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
            className={cn("field", errors.period && "is-invalid")}
            maxLength={60}
            placeholder="2023 — Present"
            {...form.register("period")}
          />
          {errors.period?.message ? <p className="field-error">{errors.period.message}</p> : null}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="role">
          Role
        </label>
        <input
          id="role"
          className={cn("field", errors.role && "is-invalid")}
          maxLength={120}
          {...form.register("role")}
        />
        {errors.role?.message ? <p className="field-error">{errors.role.message}</p> : null}
      </div>
      <div>
        <label className="label" htmlFor="company">
          Company
        </label>
        <input
          id="company"
          className={cn("field", errors.company && "is-invalid")}
          maxLength={120}
          {...form.register("company")}
        />
        {errors.company?.message ? <p className="field-error">{errors.company.message}</p> : null}
      </div>
      <div className="ex-grid2">
        <div>
          <span className="label">Accent colour</span>
          <ColorField
            value={watched.color}
            onChange={(value) => form.setValue("color", value, { shouldDirty: true })}
          />
          {errors.color?.message ? <p className="field-error">{errors.color.message}</p> : null}
        </div>
        <label className="pubrow" style={{ alignSelf: "end" }}>
          <span style={{ flex: 1 }}>
            Current role
            <small>Shows a “current” badge</small>
          </span>
          <Toggle
            checked={watched.isCurrent}
            onChange={(value) => form.setValue("isCurrent", value, { shouldDirty: true })}
            label="Current role"
          />
        </label>
      </div>
      <div>
        <span className="label">
          Highlights <em>{watched.highlights.length}/12</em>
        </span>
        {watched.highlights.length > 0 ? (
          <div className="ex-hl-list">
            {watched.highlights.map((item, index) => (
              <div key={`${item}-${index}`} className="ex-hl-item">
                <p>{item}</p>
                <button
                  type="button"
                  className="ib d"
                  aria-label="Remove highlight"
                  onClick={() =>
                    form.setValue(
                      "highlights",
                      watched.highlights.filter((_, position) => position !== index),
                      { shouldDirty: true },
                    )
                  }
                >
                  <Trash2 />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="ex-hl-empty" style={{ marginBottom: 8 }}>
            No highlights yet. Add the outcomes you are proud of.
          </div>
        )}
        <div className="srow" style={{ marginBottom: 0 }}>
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
          <button
            type="button"
            className="btn btn-ghost"
            onClick={addHighlight}
            disabled={watched.highlights.length >= 12}
          >
            Add
          </button>
        </div>
      </div>
    </FormDialog>
  );
};

/** Approximate view of the public timeline, drawn from the same data as the list. */
const TimelinePreview = ({
  entries,
  selectedId,
  onSelect,
}: {
  entries: Experience[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) => (
  <aside className="ex-preview" aria-label="Public timeline preview">
    <div className="ex-cap">
      Public timeline <small className="live">live</small>
    </div>
    <div className="ex-pv">
      <h2 className="pv-head">Experience</h2>
      {entries.length === 0 ? (
        <p className="pv-empty">Roles you add will appear here.</p>
      ) : (
        <div className="pv-track">
          {entries.map((entry) => {
            const selected = entry.id === selectedId;
            const shown = entry.highlights.slice(0, PREVIEW_HIGHLIGHTS);
            const hidden = entry.highlights.length - shown.length;
            return (
              <div
                key={entry.id}
                className={cn("pv-item", selected && "sel")}
                style={{ "--c": entry.color } as React.CSSProperties}
                onClick={() => onSelect(entry.id)}
              >
                <span className="pv-dot" aria-hidden="true" />
                <div className="pv-period">{entry.period}</div>
                <div className="pv-role">
                  {entry.role}
                  {entry.isCurrent ? <span className="pv-now">now</span> : null}
                </div>
                <div className="pv-company">{entry.company}</div>
                {selected && shown.length > 0 ? (
                  <ul className="pv-list">
                    {shown.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                ) : null}
                {selected && hidden > 0 ? <div className="pv-more">+ {hidden} more</div> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
    <p className="ex-pv-note">Approximate layout. Your public site's own styles apply.</p>
  </aside>
);

export default function ExperiencePage() {
  const query = useGetExperienceQuery({ page: 1, pageSize: 100 });
  const [reorder] = useReorderExperienceMutation();
  const [remove, removeState] = useDeleteExperienceMutation();
  const [editing, setEditing] = useState<Experience | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Experience | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const entries = query.data?.data ?? [];
  // Fall back to the first role when nothing is picked or the picked one was deleted.
  const selectedId = entries.find((entry) => entry.id === pickedId)?.id ?? entries[0]?.id ?? null;

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
      ) : entries.length > 0 ? (
        <div className="ex-layout">
          <section className="ex-main" aria-label="Roles">
            <div className="ex-cap">
              Roles <small>{entries.length} · drag the handle to reorder</small>
            </div>
            <div className="ex-panel">
              <SortableList
                items={entries.map((entry) => ({
                  id: entry.id,
                  node: (
                    <div className={cn("ex-row", entry.id === selectedId && "sel")}>
                      <span className="ex-bar" style={{ background: entry.color }} aria-hidden="true" />
                      <button
                        type="button"
                        className="ex-pick"
                        aria-pressed={entry.id === selectedId}
                        onClick={() => setPickedId(entry.id)}
                      >
                        <span className="ex-line">
                          <span className="ex-role-name">{entry.role}</span>
                          {entry.isCurrent ? <span className="ex-current">current</span> : null}
                        </span>
                        <span className="ex-meta" style={{ display: "block" }}>
                          {entry.company} · {entry.period}
                        </span>
                      </button>
                      <span className="ex-type">{entry.type}</span>
                      <span className="ex-hl" title="Highlights">
                        {entry.highlights.length} hl
                      </span>
                      <div className="ex-act">
                        <button
                          type="button"
                          className="ib"
                          aria-label={`Edit ${entry.role}`}
                          onClick={() => setEditing(entry)}
                        >
                          <Pencil />
                        </button>
                        <button
                          type="button"
                          className="ib d"
                          aria-label={`Delete ${entry.role}`}
                          onClick={() => setDeleting(entry)}
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </div>
                  ),
                }))}
                onReorder={(ids) => {
                  void reorder(ids)
                    .unwrap()
                    .catch((error: unknown) => toast.error(errorMessage(error)));
                }}
              />
              <button type="button" className="ex-add" onClick={() => setCreating(true)}>
                <Plus size={15} /> New experience
              </button>
            </div>
          </section>

          <TimelinePreview entries={entries} selectedId={selectedId} onSelect={setPickedId} />
        </div>
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
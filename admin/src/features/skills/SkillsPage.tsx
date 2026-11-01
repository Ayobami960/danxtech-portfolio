import { zodResolver } from "@hookform/resolvers/zod";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import {
  useCreateSkillMutation,
  useDeleteSkillMutation,
  useGetSkillsQuery,
  useReorderSkillsMutation,
  useUpdateSkillMutation,
} from "../../api/adminApi";
import { errorMessage } from "../../api/errors";
import type { SkillGroup } from "../../api/types";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ColorField, EmojiField, TagInput } from "../../components/Fields";
import { FormDialog } from "../../components/FormDialog";
import { PageHeader } from "../../components/PageHeader";
import { EmptyState, ErrorState, LoadingList } from "../../components/States";
import { cn } from "../../lib/cn";
import { skillSchema } from "../../lib/schemas";
import "../../style/skills.css";

type Form = z.infer<typeof skillSchema>;

const MAX_ITEMS = 40;
const COLLAPSED_CHIPS = 10;
const BLANK: Form = { title: "", icon: "🛠️", color: "#0b8f7b", items: [] };

const SkillDialog = ({
  entry,
  onClose,
  onSaved,
}: {
  entry: SkillGroup | null;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [create, createState] = useCreateSkillMutation();
  const [update, updateState] = useUpdateSkillMutation();
  const form = useForm<Form>({
    resolver: zodResolver(skillSchema),
    defaultValues: entry
      ? { title: entry.title, icon: entry.icon, color: entry.color, items: entry.items }
      : BLANK,
  });
  const watched = form.watch();
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (entry) {
        await update({ id: entry.id, patch: values }).unwrap();
        toast.success("Skill group updated");
      } else {
        await create(values).unwrap();
        toast.success("Skill group added");
      }
      onSaved();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Could not save the skill group."));
    }
  });

  return (
    <FormDialog
      open
      title={entry ? "Edit skill group" : "New skill group"}
      onClose={onClose}
      onSubmit={() => void onSubmit()}
      busy={createState.isLoading || updateState.isLoading}
    >
      <div>
        <label className="label" htmlFor="skill-title">
          Title
        </label>
        <input
          id="skill-title"
          className={cn("field", errors.title && "is-invalid")}
          maxLength={80}
          {...form.register("title")}
        />
        {errors.title?.message ? <p className="field-error">{errors.title.message}</p> : null}
      </div>
      <div>
        <span className="label">Icon</span>
        <EmojiField
          value={watched.icon}
          onChange={(value) => form.setValue("icon", value, { shouldDirty: true })}
        />
      </div>
      <div>
        <span className="label">Color</span>
        <ColorField
          value={watched.color}
          onChange={(value) => form.setValue("color", value, { shouldDirty: true })}
        />
        {errors.color?.message ? <p className="field-error">{errors.color.message}</p> : null}
      </div>
      <div>
        <span className="label">
          Items <em>{watched.items.length}/{MAX_ITEMS}</em>
        </span>
        <TagInput
          value={watched.items}
          max={MAX_ITEMS}
          maxLength={40}
          placeholder="TypeScript, React, Node…"
          onChange={(value) => form.setValue("items", value, { shouldDirty: true })}
        />
      </div>
    </FormDialog>
  );
};

export default function SkillsPage() {
  const query = useGetSkillsQuery({ page: 1, pageSize: 100 });
  const [reorder] = useReorderSkillsMutation();
  const [remove, removeState] = useDeleteSkillMutation();
  const [editing, setEditing] = useState<SkillGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<SkillGroup | null>(null);

  // `local` shows the new order instantly while it saves; the server list replaces it afterwards.
  const [local, setLocal] = useState<SkillGroup[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const gripRefs = useRef(new Map<string, HTMLButtonElement>());

  const groups = local ?? query.data?.data ?? [];
  const totalSkills = groups.reduce((sum, group) => sum + group.items.length, 0);

  const commitOrder = async (next: SkillGroup[], focusId?: string): Promise<void> => {
    setLocal(next);
    setBusy(true);
    try {
      await reorder(next.map((group) => group.id)).unwrap();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      try {
        await query.refetch();
      } finally {
        setLocal(null);
        setBusy(false);
        if (focusId) requestAnimationFrame(() => gripRefs.current.get(focusId)?.focus());
      }
    }
  };

  const moveTo = (fromId: string, toIndex: number): void => {
    const fromIndex = groups.findIndex((group) => group.id === fromId);
    if (fromIndex < 0 || toIndex < 0 || toIndex >= groups.length || fromIndex === toIndex) return;
    const next = [...groups];
    const [moved] = next.splice(fromIndex, 1);
    if (!moved) return;
    next.splice(toIndex, 0, moved);
    void commitOrder(next, fromId);
  };

  const endDrag = (): void => {
    setDragId(null);
    setTargetId(null);
  };

  const toggle = (id: string): void =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Skills"
        description="Groups of tools and technologies. Drag to reorder — the public site follows this order."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={15} /> New group
          </button>
        }
      />

      {query.isLoading ? (
        <LoadingList rows={4} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : groups.length > 0 ? (
        <>
          <div className="sk-summary">
            <span>
              <b>{groups.length}</b> {groups.length === 1 ? "group" : "groups"}
            </span>
            <span>
              <b>{totalSkills}</b> {totalSkills === 1 ? "skill" : "skills"}
            </span>
            <span>Drag a card, or focus its handle and use the arrow keys.</span>
          </div>

          <div className={cn("sk-grid", busy && "sk-busy")} aria-busy={busy}>
            {groups.map((group, index) => {
              const open = expanded.has(group.id);
              const shown = open ? group.items : group.items.slice(0, COLLAPSED_CHIPS);
              const hidden = group.items.length - shown.length;
              return (
                <section
                  key={group.id}
                  className={cn(
                    "sk-card",
                    dragId === group.id && "drag",
                    targetId === group.id && dragId !== group.id && "target",
                  )}
                  style={{ "--c": group.color } as React.CSSProperties}
                  aria-label={group.title}
                  draggable={!busy}
                  onDragStart={(event) => {
                    setDragId(group.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", group.id);
                  }}
                  onDragEnd={endDrag}
                  onDragOver={(event) => {
                    if (!dragId) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setTargetId(group.id);
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setTargetId((current) => (current === group.id ? null : current));
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const from = dragId;
                    endDrag();
                    if (from && from !== group.id) moveTo(from, index);
                  }}
                >
                  <header className="sk-head">
                    <button
                      type="button"
                      className="sk-grip"
                      ref={(node) => {
                        if (node) gripRefs.current.set(group.id, node);
                        else gripRefs.current.delete(group.id);
                      }}
                      aria-label={`Reorder ${group.title}. Position ${index + 1} of ${groups.length}. Use the arrow keys to move.`}
                      disabled={busy}
                      onKeyDown={(event) => {
                        const step =
                          event.key === "ArrowLeft" || event.key === "ArrowUp"
                            ? -1
                            : event.key === "ArrowRight" || event.key === "ArrowDown"
                              ? 1
                              : 0;
                        if (step === 0) return;
                        event.preventDefault();
                        moveTo(group.id, index + step);
                      }}
                    >
                      <GripVertical />
                    </button>
                    <span className="sk-ico" aria-hidden="true">
                      {group.icon}
                    </span>
                    <div className="sk-title">
                      <h2>{group.title}</h2>
                      <small>
                        {group.items.length} {group.items.length === 1 ? "skill" : "skills"}
                      </small>
                    </div>
                    <div className="sk-tools">
                      <button
                        type="button"
                        className="ib"
                        aria-label={`Edit ${group.title}`}
                        onClick={() => setEditing(group)}
                      >
                        <Pencil />
                      </button>
                      <button
                        type="button"
                        className="ib d"
                        aria-label={`Delete ${group.title}`}
                        onClick={() => setDeleting(group)}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </header>

                  <div className="sk-chips">
                    {group.items.length === 0 ? (
                      <p className="sk-none">No skills yet. Edit this group to add some.</p>
                    ) : (
                      <>
                        {shown.map((item) => (
                          <span key={item} className="sk-chip">
                            {item}
                          </span>
                        ))}
                        {hidden > 0 ? (
                          <button
                            type="button"
                            className="sk-more"
                            onClick={() => toggle(group.id)}
                            aria-expanded={false}
                          >
                            +{hidden} more
                          </button>
                        ) : null}
                        {open && group.items.length > COLLAPSED_CHIPS ? (
                          <button
                            type="button"
                            className="sk-more"
                            onClick={() => toggle(group.id)}
                            aria-expanded
                          >
                            Show less
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>

                  <div className="sk-foot">
                    <div
                      className="sk-meter"
                      role="progressbar"
                      aria-label={`${group.title} skills used`}
                      aria-valuemin={0}
                      aria-valuemax={MAX_ITEMS}
                      aria-valuenow={group.items.length}
                    >
                      <i style={{ width: `${(group.items.length / MAX_ITEMS) * 100}%` }} />
                    </div>
                    <small>
                      {group.items.length} of {MAX_ITEMS}
                    </small>
                  </div>
                </section>
              );
            })}

            <button type="button" className="sk-new" onClick={() => setCreating(true)}>
              <Plus size={20} />
              New group
            </button>
          </div>
        </>
      ) : (
        <EmptyState
          title="No skill groups yet"
          description="Group your skills so the public site can render them as cards."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              New group
            </button>
          }
        />
      )}

      {creating ? (
        <SkillDialog
          entry={null}
          onClose={() => setCreating(false)}
          onSaved={() => void query.refetch()}
        />
      ) : null}
      {editing ? (
        <SkillDialog
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={() => void query.refetch()}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete “${deleting?.title ?? ""}”?`}
        description="The group and its items are removed from the public site."
        busy={removeState.isLoading}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          void remove(deleting.id)
            .unwrap()
            .then(() => {
              toast.success("Skill group deleted");
              setDeleting(null);
            })
            .catch((error: unknown) => toast.error(errorMessage(error)));
        }}
      />
    </>
  );
}
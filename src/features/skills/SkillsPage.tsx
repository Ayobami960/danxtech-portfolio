import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  useCreateSkillMutation,
  useDeleteSkillMutation,
  useGetSkillsQuery,
  useReorderSkillsMutation,
  useUpdateSkillMutation,
} from "../../api/adminApi";
import type { SkillGroup } from "../../api/types";
import { errorMessage } from "../../api/errors";
import { Card } from "../../components/Card";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ColorField, EmojiField, TagInput } from "../../components/Fields";
import { FormDialog } from "../../components/FormDialog";
import { PageHeader } from "../../components/PageHeader";
import { SortableList } from "../../components/SortableList";
import { EmptyState, ErrorState, LoadingList } from "../../components/States";
import { skillSchema } from "../../lib/schemas";
import type { z } from "zod";

type Form = z.infer<typeof skillSchema>;

const BLANK: Form = { title: "", icon: "🛠️", color: "#4f8ef7", items: [] };

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
          className="field"
          maxLength={80}
          {...form.register("title")}
        />
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
      </div>
      <div>
        <span className="label">Items · max 40</span>
        <TagInput
          value={watched.items}
          max={40}
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
      ) : query.data && query.data.data.length > 0 ? (
        <Card bodyClassName="p-3">
          <SortableList
            items={query.data.data.map((group) => ({
              id: group.id,
              node: (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-lg">{group.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">
                      {group.title}
                    </div>
                    <div className="truncate font-mono text-[10px] text-[#5f7189]">
                      {group.items.join(" · ") || "No items"}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-muted hover:bg-white/5 hover:text-white"
                    aria-label={`Edit ${group.title}`}
                    onClick={() => setEditing(group)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-muted hover:bg-red-500/10 hover:text-red-300"
                    aria-label={`Delete ${group.title}`}
                    onClick={() => setDeleting(group)}
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
        <SkillDialog entry={null} onClose={() => setCreating(false)} onSaved={() => void query.refetch()} />
      ) : null}
      {editing ? (
        <SkillDialog entry={editing} onClose={() => setEditing(null)} onSaved={() => void query.refetch()} />
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

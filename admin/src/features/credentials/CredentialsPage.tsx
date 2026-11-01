import { zodResolver } from "@hookform/resolvers/zod";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import {
  useCreateCredentialMutation,
  useDeleteCredentialMutation,
  useGetCredentialsQuery,
  useReorderCredentialsMutation,
  useUpdateCredentialMutation,
} from "../../api/adminApi";
import { errorMessage } from "../../api/errors";
import type { Credential } from "../../api/types";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { FormDialog } from "../../components/FormDialog";
import { PageHeader } from "../../components/PageHeader";
import { EmptyState, ErrorState, LoadingList } from "../../components/States";
import { cn } from "../../lib/cn";
import { credentialSchema } from "../../lib/schemas";

import "../../style/credentials.css";

type Form = z.infer<typeof credentialSchema>;
type Kind = Form["kind"];

const BLANK: Form = {
  kind: "degree",
  title: "",
  issuer: "",
  period: "",
  detail: "",
};

const SECTIONS: { kind: Kind; label: string; empty: string; add: string }[] = [
  { kind: "degree", label: "Degrees", empty: "No degrees yet.", add: "Add degree" },
  {
    kind: "certification",
    label: "Certifications",
    empty: "No certifications yet.",
    add: "Add certification",
  },
];

const CredentialDialog = ({
  entry,
  initialKind,
  onClose,
  onSaved,
}: {
  entry: Credential | null;
  initialKind?: Kind;
  onClose: () => void;
  onSaved: () => void;
}) => {
  const [create, createState] = useCreateCredentialMutation();
  const [update, updateState] = useUpdateCredentialMutation();
  const form = useForm<Form>({
    resolver: zodResolver(credentialSchema),
    defaultValues: entry
      ? {
          kind: entry.kind,
          title: entry.title,
          issuer: entry.issuer,
          period: entry.period ?? "",
          detail: entry.detail ?? "",
        }
      : { ...BLANK, kind: initialKind ?? BLANK.kind },
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (entry) {
        await update({
          id: entry.id,
          patch: {
            ...values,
            period: values.period ? values.period : null,
            detail: values.detail ? values.detail : null,
          },
        }).unwrap();
        toast.success("Credential updated");
      } else {
        await create({
          ...values,
          period: values.period ? values.period : null,
          detail: values.detail ? values.detail : null,
        }).unwrap();
        toast.success("Credential added");
      }
      onSaved();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, "Could not save the credential."));
    }
  });

  return (
    <FormDialog
      open
      title={entry ? "Edit credential" : "New credential"}
      onClose={onClose}
      onSubmit={() => void onSubmit()}
      busy={createState.isLoading || updateState.isLoading}
    >
      <div className="cr-grid2">
        <div>
          <label className="label" htmlFor="credential-kind">
            Kind
          </label>
          <select id="credential-kind" className="field" {...form.register("kind")}>
            <option value="degree">Degree</option>
            <option value="certification">Certification</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="credential-period">
            Period
          </label>
          <input
            id="credential-period"
            className={cn("field", errors.period && "is-invalid")}
            maxLength={60}
            placeholder="2019 — 2023"
            {...form.register("period")}
          />
          {errors.period?.message ? <p className="field-error">{errors.period.message}</p> : null}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="credential-title">
          Title
        </label>
        <input
          id="credential-title"
          className={cn("field", errors.title && "is-invalid")}
          maxLength={160}
          {...form.register("title")}
        />
        {errors.title?.message ? <p className="field-error">{errors.title.message}</p> : null}
      </div>
      <div>
        <label className="label" htmlFor="credential-issuer">
          Issuer
        </label>
        <input
          id="credential-issuer"
          className={cn("field", errors.issuer && "is-invalid")}
          maxLength={160}
          {...form.register("issuer")}
        />
        {errors.issuer?.message ? <p className="field-error">{errors.issuer.message}</p> : null}
      </div>
      <div>
        <label className="label" htmlFor="credential-detail">
          Detail · {form.watch("detail").length}/200
        </label>
        <textarea
          id="credential-detail"
          className={cn("field min-h-20", errors.detail && "is-invalid")}
          maxLength={200}
          {...form.register("detail")}
        />
        {errors.detail?.message ? <p className="field-error">{errors.detail.message}</p> : null}
      </div>
    </FormDialog>
  );
};

export default function CredentialsPage() {
  const query = useGetCredentialsQuery({ page: 1, pageSize: 100 });
  const [reorder] = useReorderCredentialsMutation();
  const [remove, removeState] = useDeleteCredentialMutation();
  const [editing, setEditing] = useState<Credential | null>(null);
  const [creating, setCreating] = useState<Kind | null>(null);
  const [deleting, setDeleting] = useState<Credential | null>(null);

  // `local` shows the new order instantly while it saves; the server list replaces it afterwards.
  const [local, setLocal] = useState<Credential[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const gripRefs = useRef(new Map<string, HTMLButtonElement>());

  const all = local ?? query.data?.data ?? [];
  const countOf = (kind: Kind): number => all.filter((entry) => entry.kind === kind).length;

  const commitOrder = async (next: Credential[], focusId?: string): Promise<void> => {
    setLocal(next);
    setBusy(true);
    try {
      await reorder(next.map((entry) => entry.id)).unwrap();
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

  // Reorders inside one kind. The saved order stays a single list: each kind's slots are
  // refilled in the new order, so the other kind keeps its place.
  const moveWithin = (kind: Kind, fromId: string, toId: string): void => {
    const group = all.filter((entry) => entry.kind === kind);
    const fromIndex = group.findIndex((entry) => entry.id === fromId);
    const toIndex = group.findIndex((entry) => entry.id === toId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    const reordered = [...group];
    const [moved] = reordered.splice(fromIndex, 1);
    if (!moved) return;
    reordered.splice(toIndex, 0, moved);
    let cursor = 0;
    const next = all.map((entry) => (entry.kind === kind ? (reordered[cursor++] as Credential) : entry));
    void commitOrder(next, fromId);
  };

  const endDrag = (): void => {
    setDragId(null);
    setTargetId(null);
  };

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Credentials"
        description="Education and certifications. Degrees and certifications are grouped on the public site."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreating("degree")}>
            <Plus size={15} /> New credential
          </button>
        }
      />

      {query.isLoading ? (
        <LoadingList rows={4} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : all.length > 0 ? (
        <>
          <div className="cr-summary">
            <span>
              <b>{countOf("degree")}</b> {countOf("degree") === 1 ? "degree" : "degrees"}
            </span>
            <span>
              <b>{countOf("certification")}</b>{" "}
              {countOf("certification") === 1 ? "certification" : "certifications"}
            </span>
            <span>Drag a row, or focus its handle and use the arrow keys.</span>
          </div>

          <div className={cn(busy && "cr-busy")} aria-busy={busy}>
            {SECTIONS.map((section) => {
              const group = all.filter((entry) => entry.kind === section.kind);
              return (
                <section
                  key={section.kind}
                  className={cn("cr-section", section.kind === "certification" && "cert")}
                  aria-label={section.label}
                >
                  <div className="cr-sec-head">
                    <span className="cr-dot" aria-hidden="true" />
                    <h2>{section.label}</h2>
                    <small>{group.length}</small>
                  </div>
                  <div className="cr-list">
                    {group.length === 0 ? (
                      <p className="cr-none">{section.empty}</p>
                    ) : (
                      group.map((entry, index) => {
                        const meta = [entry.issuer, entry.period].filter(Boolean).join(" · ");
                        return (
                          <div
                            key={entry.id}
                            className={cn(
                              "cr-row",
                              dragId === entry.id && "drag",
                              targetId === entry.id && dragId !== entry.id && "target",
                            )}
                            draggable={!busy}
                            onDragStart={(event) => {
                              setDragId(entry.id);
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", entry.id);
                            }}
                            onDragEnd={endDrag}
                            onDragOver={(event) => {
                              // Only rows of the same kind accept a drop.
                              const dragged = all.find((item) => item.id === dragId);
                              if (!dragged || dragged.kind !== entry.kind) return;
                              event.preventDefault();
                              event.dataTransfer.dropEffect = "move";
                              setTargetId(entry.id);
                            }}
                            onDragLeave={(event) => {
                              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                                setTargetId((current) => (current === entry.id ? null : current));
                              }
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              const from = dragId;
                              endDrag();
                              if (from && from !== entry.id) moveWithin(entry.kind, from, entry.id);
                            }}
                          >
                            <button
                              type="button"
                              className="cr-grip"
                              ref={(node) => {
                                if (node) gripRefs.current.set(entry.id, node);
                                else gripRefs.current.delete(entry.id);
                              }}
                              aria-label={`Reorder ${entry.title}. Position ${index + 1} of ${group.length}. Use the arrow keys to move.`}
                              disabled={busy}
                              onKeyDown={(event) => {
                                const step =
                                  event.key === "ArrowUp" || event.key === "ArrowLeft"
                                    ? -1
                                    : event.key === "ArrowDown" || event.key === "ArrowRight"
                                      ? 1
                                      : 0;
                                if (step === 0) return;
                                event.preventDefault();
                                const neighbour = group[index + step];
                                if (neighbour) moveWithin(entry.kind, entry.id, neighbour.id);
                              }}
                            >
                              <GripVertical />
                            </button>
                            <div className="cr-body">
                              <div className="cr-title">{entry.title}</div>
                              <div className="cr-meta">{meta || "—"}</div>
                              {entry.detail ? <p className="cr-detail">{entry.detail}</p> : null}
                            </div>
                            <div className="cr-act">
                              <button
                                type="button"
                                className="ib"
                                aria-label={`Edit ${entry.title}`}
                                onClick={() => setEditing(entry)}
                              >
                                <Pencil />
                              </button>
                              <button
                                type="button"
                                className="ib d"
                                aria-label={`Delete ${entry.title}`}
                                onClick={() => setDeleting(entry)}
                              >
                                <Trash2 />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <button type="button" className="cr-add" onClick={() => setCreating(section.kind)}>
                      <Plus size={15} /> {section.add}
                    </button>
                  </div>
                </section>
              );
            })}
          </div>
        </>
      ) : (
        <EmptyState
          title="No credentials yet"
          description="Add the degrees and certifications shown in the About section."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setCreating("degree")}>
              New credential
            </button>
          }
        />
      )}

      {creating ? (
        <CredentialDialog
          entry={null}
          initialKind={creating}
          onClose={() => setCreating(null)}
          onSaved={() => void query.refetch()}
        />
      ) : null}
      {editing ? (
        <CredentialDialog
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={() => void query.refetch()}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete “${deleting?.title ?? ""}”?`}
        description="This removes the credential from the public site."
        busy={removeState.isLoading}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          void remove(deleting.id)
            .unwrap()
            .then(() => {
              toast.success("Credential deleted");
              setDeleting(null);
            })
            .catch((error: unknown) => toast.error(errorMessage(error)));
        }}
      />
    </>
  );
}
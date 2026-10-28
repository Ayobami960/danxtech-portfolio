import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  useCreateCredentialMutation,
  useDeleteCredentialMutation,
  useGetCredentialsQuery,
  useReorderCredentialsMutation,
  useUpdateCredentialMutation,
} from "../../api/adminApi";
import type { Credential } from "../../api/types";
import { errorMessage } from "../../api/errors";
import { Card } from "../../components/Card";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { FormDialog } from "../../components/FormDialog";
import { PageHeader } from "../../components/PageHeader";
import { SortableList } from "../../components/SortableList";
import { EmptyState, ErrorState, LoadingList } from "../../components/States";
import { credentialSchema } from "../../lib/schemas";
import type { z } from "zod";

type Form = z.infer<typeof credentialSchema>;

const BLANK: Form = {
  kind: "degree",
  title: "",
  issuer: "",
  period: "",
  detail: "",
};

const CredentialDialog = ({
  entry,
  onClose,
  onSaved,
}: {
  entry: Credential | null;
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
      : BLANK,
  });

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
      <div className="grid gap-3 sm:grid-cols-2">
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
            className="field"
            maxLength={60}
            placeholder="2019 — 2023"
            {...form.register("period")}
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="credential-title">
          Title
        </label>
        <input
          id="credential-title"
          className="field"
          maxLength={160}
          {...form.register("title")}
        />
      </div>
      <div>
        <label className="label" htmlFor="credential-issuer">
          Issuer
        </label>
        <input
          id="credential-issuer"
          className="field"
          maxLength={160}
          {...form.register("issuer")}
        />
      </div>
      <div>
        <label className="label" htmlFor="credential-detail">
          Detail · {form.watch("detail").length}/200
        </label>
        <textarea
          id="credential-detail"
          className="field min-h-20"
          maxLength={200}
          {...form.register("detail")}
        />
      </div>
    </FormDialog>
  );
};

export default function CredentialsPage() {
  const query = useGetCredentialsQuery({ page: 1, pageSize: 100 });
  const [reorder] = useReorderCredentialsMutation();
  const [remove, removeState] = useDeleteCredentialMutation();
  const [editing, setEditing] = useState<Credential | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Credential | null>(null);

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Credentials"
        description="Education and certifications. Degrees and certifications are grouped on the public site."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={15} /> New credential
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
            items={query.data.data.map((entry) => ({
              id: entry.id,
              node: (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-[9px] uppercase tracking-wide text-[#f0a500]">
                    {entry.kind}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-white">
                      {entry.title}
                    </div>
                    <div className="truncate font-mono text-[10px] text-[#5f7189]">
                      {[entry.issuer, entry.period].filter(Boolean).join(" · ") || "—"}
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
          title="No credentials yet"
          description="Add the degrees and certifications shown in the About section."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              New credential
            </button>
          }
        />
      )}

      {creating ? (
        <CredentialDialog
          entry={null}
          onClose={() => setCreating(false)}
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

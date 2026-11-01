import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useGetSettingsQuery, useUpdateSettingsMutation } from "../../api/adminApi";
import { errorMessage, getFieldErrors } from "../../api/errors";
import { Card } from "../../components/Card";
import { PageHeader } from "../../components/PageHeader";
import { ErrorState, LoadingList } from "../../components/States";
import { settingsSchema } from "../../lib/schemas";
import { useUnsavedWarning } from "../../lib/useUnsavedWarning";
import type { z } from "zod";

type Form = z.infer<typeof settingsSchema>;

const DEFAULT_VALUES: Form = { contactEmail: "", phone: "", location: "" };

export default function SettingsPage() {
  const query = useGetSettingsQuery();
  const [update, updateState] = useUpdateSettingsMutation();
  const form = useForm<Form>({
    resolver: zodResolver(settingsSchema),
    defaultValues: DEFAULT_VALUES,
  });
  useUnsavedWarning(form.formState.isDirty);

  useEffect(() => {
    if (!query.data) return;
    form.reset({
      contactEmail: query.data.contactEmail,
      phone: query.data.phone,
      location: query.data.location,
    });
  }, [query.data, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await update(values).unwrap();
      form.reset(values);
      toast.success("Contact details saved");
    } catch (error) {
      const fields = getFieldErrors(error);
      for (const [path, message] of Object.entries(fields)) {
        form.setError(path as keyof Form, { message });
      }
      toast.error(errorMessage(error, "Could not save the settings."));
    }
  });

  if (query.isLoading) return <LoadingList rows={3} />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.refetch} />;

  return (
    <>
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="Contact details used by the public site's contact section and email fallbacks."
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void onSubmit()}
            disabled={updateState.isLoading}
          >
            <Save size={15} /> {updateState.isLoading ? "Saving…" : "Save settings"}
          </button>
        }
      />

      <Card title="contact_details" className="max-w-2xl">
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          <div>
            <label className="label" htmlFor="contactEmail">
              Contact email
            </label>
            <input
              id="contactEmail"
              type="email"
              className="field"
              autoComplete="email"
              {...form.register("contactEmail")}
            />
            {form.formState.errors.contactEmail ? (
              <p className="mt-1 text-xs text-red-300">
                {form.formState.errors.contactEmail.message}
              </p>
            ) : null}
          </div>
          <div>
            <label className="label" htmlFor="phone">
              Phone (optional)
            </label>
            <input
              id="phone"
              className="field"
              autoComplete="tel"
              {...form.register("phone")}
            />
            {form.formState.errors.phone ? (
              <p className="mt-1 text-xs text-red-300">
                {form.formState.errors.phone.message}
              </p>
            ) : null}
          </div>
          <div>
            <label className="label" htmlFor="location">
              Location
            </label>
            <input
              id="location"
              className="field"
              maxLength={100}
              {...form.register("location")}
            />
            {form.formState.errors.location ? (
              <p className="mt-1 text-xs text-red-300">
                {form.formState.errors.location.message}
              </p>
            ) : null}
          </div>
        </form>
      </Card>
    </>
  );
}

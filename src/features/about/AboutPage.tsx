import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { useGetAboutQuery, useUpdateAboutMutation } from "../../api/adminApi";
import { errorMessage } from "../../api/errors";
import { Card } from "../../components/Card";
import { EmojiField, TagInput } from "../../components/Fields";
import { PageHeader } from "../../components/PageHeader";
import { ErrorState, LoadingList } from "../../components/States";
import { aboutSchema, type AboutForm } from "../../lib/schemas";
import { useUnsavedWarning } from "../../lib/useUnsavedWarning";

const DEFAULT_VALUES: AboutForm = {
  paragraphs: [""],
  tags: [],
  metrics: [],
  principles: [],
};

export default function AboutPage() {
  const query = useGetAboutQuery();
  const [update, updateState] = useUpdateAboutMutation();

  const form = useForm<AboutForm>({
    resolver: zodResolver(aboutSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const paragraphs = useFieldArray({
    control: form.control,
    name: "paragraphs" as never,
  });
  const metrics = useFieldArray({ control: form.control, name: "metrics" });
  const principles = useFieldArray({ control: form.control, name: "principles" });
  const watched = form.watch();
  useUnsavedWarning(form.formState.isDirty);

  useEffect(() => {
    if (!query.data) return;
    form.reset({
      paragraphs: query.data.paragraphs.length > 0 ? query.data.paragraphs : [""],
      tags: query.data.tags,
      metrics: query.data.metrics,
      principles: query.data.principles,
    });
  }, [query.data, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await update({
        ...values,
        paragraphs: values.paragraphs.filter((paragraph) => paragraph.trim() !== ""),
      }).unwrap();
      form.reset(values);
      toast.success("About section saved");
    } catch (error) {
      toast.error(errorMessage(error, "Could not save the about section."));
    }
  });

  if (query.isLoading) return <LoadingList rows={5} />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.refetch} />;

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="About"
        description="Paragraphs, tags, headline metrics and the principles a visitor reads about you."
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void onSubmit()}
            disabled={updateState.isLoading}
          >
            <Save size={15} /> {updateState.isLoading ? "Saving…" : "Save about"}
          </button>
        }
      />

      <div className="space-y-5">
        <Card title="paragraphs">
          <div className="space-y-3">
            {paragraphs.fields.map((field, index) => (
              <div key={field.id}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="label mb-0!">Paragraph {index + 1}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="btn btn-ghost px-2! py-1!"
                      aria-label="Move paragraph up"
                      disabled={index === 0}
                      onClick={() => paragraphs.move(index, index - 1)}
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost px-2! py-1!"
                      aria-label="Move paragraph down"
                      disabled={index === paragraphs.fields.length - 1}
                      onClick={() => paragraphs.move(index, index + 1)}
                    >
                      <ArrowDown size={12} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost px-2! py-1!"
                      aria-label="Remove paragraph"
                      disabled={paragraphs.fields.length === 1}
                      onClick={() => paragraphs.remove(index)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <textarea
                  className="field min-h-24"
                  maxLength={1200}
                  aria-label={`Paragraph ${index + 1}`}
                  {...form.register(`paragraphs.${index}` as const)}
                />
                <div className="mt-1 text-right font-mono text-[10px] text-[#5f7189]">
                  {(watched.paragraphs[index] ?? "").length}/1200
                </div>
              </div>
            ))}
            {paragraphs.fields.length < 6 ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => paragraphs.append("" as never)}
              >
                <Plus size={14} /> Add paragraph
              </button>
            ) : null}
          </div>
        </Card>

        <Card title="tags">
          <TagInput
            value={watched.tags}
            max={12}
            maxLength={30}
            placeholder="Full-stack, Security-first, React…"
            onChange={(value) => form.setValue("tags", value, { shouldDirty: true })}
          />
        </Card>

        <Card title="metrics">
          <div className="space-y-2">
            {metrics.fields.map((field, index) => (
              <div key={field.id} className="flex flex-wrap gap-2">
                <input
                  className="field sm:max-w-30"
                  maxLength={10}
                  placeholder="5+"
                  aria-label="Metric value"
                  {...form.register(`metrics.${index}.value`)}
                />
                <input
                  className="field min-w-0 flex-1"
                  maxLength={40}
                  placeholder="Years building software"
                  aria-label="Metric label"
                  {...form.register(`metrics.${index}.label`)}
                />
                <button
                  type="button"
                  className="btn btn-ghost px-2!"
                  aria-label="Remove metric"
                  onClick={() => metrics.remove(index)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            {metrics.fields.length < 4 ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => metrics.append({ value: "", label: "" })}
              >
                <Plus size={14} /> Add metric
              </button>
            ) : null}
          </div>
        </Card>

        <Card title="principles">
          <div className="space-y-4">
            {principles.fields.map((field, index) => (
              <div key={field.id} className="rounded-xl border border-white/10 p-3">
                <div className="flex items-start gap-3">
                  <div className="w-24 shrink-0">
                    <span className="label">Icon</span>
                    <EmojiField
                      value={watched.principles[index]?.icon ?? ""}
                      onChange={(value) =>
                        principles.update(index, {
                          ...watched.principles[index],
                          icon: value,
                        })
                      }
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      className="field"
                      maxLength={60}
                      placeholder="Principle title"
                      aria-label="Principle title"
                      {...form.register(`principles.${index}.title`)}
                    />
                    <textarea
                      className="field min-h-20"
                      maxLength={300}
                      placeholder="What this principle means in practice"
                      aria-label="Principle body"
                      {...form.register(`principles.${index}.body`)}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost px-2!"
                    aria-label="Remove principle"
                    onClick={() => principles.remove(index)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
            {principles.fields.length < 6 ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  principles.append({ icon: "🛡️", title: "", body: "" })
                }
              >
                <Plus size={14} /> Add principle
              </button>
            ) : null}
          </div>
        </Card>
      </div>
    </>
  );
}

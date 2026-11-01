import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { useGetAboutQuery, useUpdateAboutMutation } from "../../api/adminApi";
import { errorMessage } from "../../api/errors";
import { TagInput } from "../../components/Fields";
import { PageHeader } from "../../components/PageHeader";
import { ErrorState, LoadingList } from "../../components/States";
import { cn } from "../../lib/cn";
import { aboutSchema, type AboutForm } from "../../lib/schemas";
import { useUnsavedWarning } from "../../lib/useUnsavedWarning";

import "../../style/about.css";
import { IconPicker } from "../../components/Iconpicker";

const DEFAULT_VALUES: AboutForm = {
  paragraphs: [""],
  tags: [],
  metrics: [],
  principles: [],
};

const LIMITS = { paragraphs: 6, tags: 12, metrics: 4, principles: 6 } as const;

const PRINCIPLE_SUGGESTIONS = [
  { icon: "🛡️", title: "Security first", body: "Threat-model before shipping, and treat every input as untrusted." },
  { icon: "⚡", title: "Fast by default", body: "Set performance budgets early so speed is never an afterthought." },
  { icon: "🎯", title: "Simple wins", body: "Choose the smallest design that solves the problem well." },
];

/** Approximate phone view of the About section, rendered from the live form values. */
const PhonePreview = ({ values }: { values: AboutForm }) => {
  const paragraphs = values.paragraphs.filter((paragraph) => paragraph.trim() !== "");
  const metrics = values.metrics.filter((metric) => metric.value.trim() || metric.label.trim());
  const principles = values.principles.filter(
    (principle) => principle.title.trim() || principle.body.trim(),
  );

  return (
    <aside className="ab-preview" aria-label="Phone preview">
      <div className="ab-preview-cap">
        Phone preview <small>live</small>
      </div>
      <div className="ab-phone">
        <div className="ab-screen">
          <span className="ab-notch" aria-hidden="true" />
          <div className="ab-scroll">
            <h2 className="pv-title">About</h2>

            {paragraphs.length > 0 ? (
              paragraphs.map((paragraph, index) => (
                <p key={index} className="pv-p">
                  {paragraph}
                </p>
              ))
            ) : (
              <p className="pv-p pv-ghost">Your story will appear here.</p>
            )}

            {values.tags.length > 0 ? (
              <div className="pv-tags">
                {values.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            ) : null}

            {metrics.length > 0 ? (
              <div className="pv-metrics">
                {metrics.map((metric, index) => (
                  <div key={index} className="pv-metric">
                    <b>{metric.value || "—"}</b>
                    <span>{metric.label}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {principles.length > 0 ? (
              <>
                <div className="pv-sub">Principles</div>
                {principles.map((principle, index) => (
                  <div key={index} className="pv-principle">
                    <span>{principle.icon}</span>
                    <div>
                      <b>{principle.title || "Untitled"}</b>
                      {principle.body ? <p>{principle.body}</p> : null}
                    </div>
                  </div>
                ))}
              </>
            ) : null}
          </div>
        </div>
      </div>
      <p className="ab-preview-note">Approximate layout. Your public site's own styles apply.</p>
    </aside>
  );
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
  const errors = form.formState.errors;
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

  const onSubmit = form.handleSubmit(
    async (values) => {
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
    },
    () => toast.error("Fix the highlighted fields, then save again."),
  );

  if (query.isLoading) return <LoadingList rows={5} />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.refetch} />;

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="About"
        description="Paragraphs, tags, headline metrics and the principles a visitor reads about you."
        actions={
          <>
            {form.formState.isDirty ? <span className="ab-dirty">Unsaved changes</span> : null}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void onSubmit()}
              disabled={updateState.isLoading}
            >
              <Save size={15} /> {updateState.isLoading ? "Saving…" : "Save about"}
            </button>
          </>
        }
      />

      <div className="ab-layout">
        <div className="ab-forms">
          <section className="ab-panel" aria-label="Paragraphs">
            <div className="ab-head">
              <h2>Story</h2>
              <p>Up to {LIMITS.paragraphs} paragraphs, 1200 characters each.</p>
              <small>
                {paragraphs.fields.length}/{LIMITS.paragraphs}
              </small>
            </div>
            <div className="ab-body">
              {paragraphs.fields.map((field, index) => {
                const length = (watched.paragraphs[index] ?? "").length;
                return (
                  <div key={field.id}>
                    <div className="ab-item-head">
                      <span className="label">Paragraph {index + 1}</span>
                      <div className="ab-tools">
                        <button
                          type="button"
                          className="ib"
                          aria-label="Move paragraph up"
                          disabled={index === 0}
                          onClick={() => paragraphs.move(index, index - 1)}
                        >
                          <ArrowUp />
                        </button>
                        <button
                          type="button"
                          className="ib"
                          aria-label="Move paragraph down"
                          disabled={index === paragraphs.fields.length - 1}
                          onClick={() => paragraphs.move(index, index + 1)}
                        >
                          <ArrowDown />
                        </button>
                        <button
                          type="button"
                          className="ib d"
                          aria-label="Remove paragraph"
                          disabled={paragraphs.fields.length === 1}
                          onClick={() => paragraphs.remove(index)}
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </div>
                    <textarea
                      className="field"
                      style={{ minHeight: 96 }}
                      maxLength={1200}
                      aria-label={`Paragraph ${index + 1}`}
                      {...form.register(`paragraphs.${index}` as const)}
                    />
                    <div className={cn("ab-counter", length > 1100 && "warn")}>{length}/1200</div>
                  </div>
                );
              })}
              {errors.paragraphs ? (
                <p className="field-error">Check your paragraphs and try again.</p>
              ) : null}
              {paragraphs.fields.length < LIMITS.paragraphs ? (
                <button
                  type="button"
                  className="btn btn-ghost ab-add"
                  onClick={() => paragraphs.append("" as never)}
                >
                  <Plus size={14} /> Add paragraph
                </button>
              ) : null}
            </div>
          </section>

          <section className="ab-panel" aria-label="Tags">
            <div className="ab-head">
              <h2>Tags</h2>
              <p>Short keywords shown under your story.</p>
              <small>
                {watched.tags.length}/{LIMITS.tags}
              </small>
            </div>
            <div className="ab-body">
              <TagInput
                value={watched.tags}
                max={LIMITS.tags}
                maxLength={30}
                placeholder="Full-stack, Security-first, React…"
                onChange={(value) => form.setValue("tags", value, { shouldDirty: true })}
              />
              {errors.tags ? <p className="field-error">Check your tags and try again.</p> : null}
            </div>
          </section>

          <section className="ab-panel" aria-label="Metrics">
            <div className="ab-head">
              <h2>Metrics</h2>
              <p>Up to {LIMITS.metrics} numbers visitors remember.</p>
              <small>
                {metrics.fields.length}/{LIMITS.metrics}
              </small>
            </div>
            <div className="ab-body">
              {metrics.fields.length === 0 ? (
                <div className="ab-empty">
                  <b>No metrics yet</b>
                  Add a number and a label, like “5+” and “Years building software”.
                </div>
              ) : null}
              {metrics.fields.map((field, index) => (
                <div key={field.id} className="ab-row">
                  <input
                    className="field value"
                    maxLength={10}
                    placeholder="5+"
                    aria-label="Metric value"
                    {...form.register(`metrics.${index}.value`)}
                  />
                  <input
                    className="field grow"
                    maxLength={40}
                    placeholder="Years building software"
                    aria-label="Metric label"
                    {...form.register(`metrics.${index}.label`)}
                  />
                  <button
                    type="button"
                    className="ib d"
                    aria-label="Remove metric"
                    onClick={() => metrics.remove(index)}
                  >
                    <Trash2 />
                  </button>
                </div>
              ))}
              {errors.metrics ? (
                <p className="field-error">Every metric needs a value and a label.</p>
              ) : null}
              {metrics.fields.length < LIMITS.metrics ? (
                <button
                  type="button"
                  className="btn btn-ghost ab-add"
                  onClick={() => metrics.append({ value: "", label: "" })}
                >
                  <Plus size={14} /> Add metric
                </button>
              ) : null}
            </div>
          </section>

          <section className="ab-panel" aria-label="Principles">
            <div className="ab-head">
              <h2>Principles</h2>
              <p>The values behind your work, each with an icon, a title and a short explanation.</p>
              <small>
                {principles.fields.length}/{LIMITS.principles}
              </small>
            </div>
            <div className="ab-body">
              {principles.fields.length === 0 ? (
                <div className="ab-empty">
                  <b>No principles yet</b>
                  Start from a suggestion, or add your own.
                  <div className="pr-suggest">
                    {PRINCIPLE_SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion.title}
                        type="button"
                        className="pr-sg"
                        onClick={() => principles.append(suggestion)}
                      >
                        <span aria-hidden="true">{suggestion.icon}</span>
                        <div>
                          <b>{suggestion.title}</b>
                          <small>{suggestion.body}</small>
                        </div>
                        <em>Use</em>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="pr-list">
                {principles.fields.map((field, index) => {
                  const rowErrors = errors.principles?.[index];
                  const titleLength = (watched.principles[index]?.title ?? "").length;
                  const bodyLength = (watched.principles[index]?.body ?? "").length;
                  return (
                    <div key={field.id} className="pr-card">
                      <div className="pr-top">
                        <span className="pr-num">{String(index + 1).padStart(2, "0")}</span>
                        <span className="pr-label">Principle</span>
                        <div className="ab-tools">
                          <button
                            type="button"
                            className="ib"
                            aria-label="Move principle up"
                            disabled={index === 0}
                            onClick={() => principles.move(index, index - 1)}
                          >
                            <ArrowUp />
                          </button>
                          <button
                            type="button"
                            className="ib"
                            aria-label="Move principle down"
                            disabled={index === principles.fields.length - 1}
                            onClick={() => principles.move(index, index + 1)}
                          >
                            <ArrowDown />
                          </button>
                          <button
                            type="button"
                            className="ib d"
                            aria-label="Remove principle"
                            onClick={() => principles.remove(index)}
                          >
                            <Trash2 />
                          </button>
                        </div>
                      </div>

                      <div className="pr-main">
                        <IconPicker
                          value={watched.principles[index]?.icon ?? ""}
                          label={`Choose icon for principle ${index + 1}`}
                          onChange={(icon) =>
                            form.setValue(`principles.${index}.icon`, icon, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                        />
                        <div className="pr-fields">
                          <div>
                            <input
                              className={cn("field pr-title", rowErrors?.title && "is-invalid")}
                              maxLength={60}
                              placeholder="Principle title"
                              aria-label="Principle title"
                              {...form.register(`principles.${index}.title`)}
                            />
                            <div className="pr-foot">
                              {rowErrors?.title?.message ? (
                                <p className="field-error">{rowErrors.title.message}</p>
                              ) : null}
                              <span className="ab-counter">{titleLength}/60</span>
                            </div>
                          </div>
                          <div>
                            <textarea
                              className={cn("field pr-body", rowErrors?.body && "is-invalid")}
                              maxLength={300}
                              placeholder="What this principle means in practice"
                              aria-label="Principle description"
                              {...form.register(`principles.${index}.body`)}
                            />
                            <div className="pr-foot">
                              {rowErrors?.body?.message ? (
                                <p className="field-error">{rowErrors.body.message}</p>
                              ) : null}
                              <span className={cn("ab-counter", bodyLength > 270 && "warn")}>
                                {bodyLength}/300
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {errors.principles?.message ? (
                <p className="field-error">{errors.principles.message}</p>
              ) : null}
              {principles.fields.length > 0 && principles.fields.length < LIMITS.principles ? (
                <button
                  type="button"
                  className="btn btn-ghost ab-add"
                  onClick={() => principles.append({ icon: "🛡️", title: "", body: "" })}
                >
                  <Plus size={14} /> Add principle{" "}
                  <small>
                    {principles.fields.length}/{LIMITS.principles}
                  </small>
                </button>
              ) : null}
            </div>
          </section>
        </div>

        <PhonePreview values={watched} />
      </div>
    </>
  );
}
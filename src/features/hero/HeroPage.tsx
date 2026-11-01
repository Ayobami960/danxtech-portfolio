import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { useGetHeroQuery, useUpdateHeroMutation } from "../../api/adminApi";
import { errorMessage } from "../../api/errors";
import { Card } from "../../components/Card";
import { TagInput, Toggle } from "../../components/Fields";
import { PageHeader } from "../../components/PageHeader";
import { ErrorState, LoadingList } from "../../components/States";
import { heroSchema, type HeroForm } from "../../lib/schemas";
import { useUnsavedWarning } from "../../lib/useUnsavedWarning";

const DEFAULT_VALUES: HeroForm = {
  nameParts: [],
  typingPhrases: [""],
  intro: "",
  location: "",
  isAvailable: true,
  availabilityLabel: "Available for work",
  stats: [],
  socials: [],
};

const PLATFORMS = ["github", "linkedin", "twitter", "email"] as const;

export default function HeroPage() {
  const query = useGetHeroQuery();
  const [update, updateState] = useUpdateHeroMutation();

  const form = useForm<HeroForm>({
    resolver: zodResolver(heroSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const phrases = useFieldArray({
    control: form.control,
    name: "typingPhrases" as never,
  });
  const stats = useFieldArray({ control: form.control, name: "stats" });
  const socials = useFieldArray({ control: form.control, name: "socials" });
  const watched = form.watch();
  useUnsavedWarning(form.formState.isDirty);

  useEffect(() => {
    if (!query.data) return;
    form.reset({
      nameParts: query.data.nameParts,
      typingPhrases: query.data.typingPhrases.length > 0 ? query.data.typingPhrases : [""],
      intro: query.data.intro,
      location: query.data.location,
      isAvailable: query.data.isAvailable,
      availabilityLabel: query.data.availabilityLabel,
      stats: query.data.stats,
      socials: query.data.socials,
    });
  }, [query.data, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await update({
        ...values,
        typingPhrases: values.typingPhrases.filter((phrase) => phrase.trim() !== ""),
      }).unwrap();
      form.reset(values);
      toast.success("Hero saved");
    } catch (error) {
      toast.error(errorMessage(error, "Could not save the hero."));
    }
  });

  if (query.isLoading) return <LoadingList rows={5} />;
  if (query.error) return <ErrorState error={query.error} onRetry={query.refetch} />;

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Hero"
        description="The first thing a visitor reads. Changes appear on the public site within about a minute."
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void onSubmit()}
            disabled={updateState.isLoading}
          >
            <Save size={15} /> {updateState.isLoading ? "Saving…" : "Save hero"}
          </button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card title="identity">
            <div className="space-y-4">
              <div>
                <span className="label">Name parts · 1–4</span>
                <TagInput
                  value={watched.nameParts}
                  max={4}
                  maxLength={30}
                  placeholder="Adetoye, Daniel, Kehinde"
                  onChange={(value) =>
                    form.setValue("nameParts", value, { shouldDirty: true })
                  }
                />
              </div>

              <div>
                <span className="label">Typing phrases · 1–10</span>
                <div className="space-y-2">
                  {phrases.fields.map((field, index) => (
                    <div key={field.id} className="flex gap-1.5">
                      <input
                        className="field"
                        maxLength={60}
                        placeholder="I build secure web apps"
                        aria-label={`Typing phrase ${index + 1}`}
                        {...form.register(`typingPhrases.${index}` as const)}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost !px-2"
                        aria-label="Move phrase up"
                        disabled={index === 0}
                        onClick={() => phrases.move(index, index - 1)}
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost !px-2"
                        aria-label="Move phrase down"
                        disabled={index === phrases.fields.length - 1}
                        onClick={() => phrases.move(index, index + 1)}
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost !px-2"
                        aria-label="Remove phrase"
                        onClick={() => phrases.remove(index)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  {phrases.fields.length < 10 ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => phrases.append("" as never)}
                    >
                      <Plus size={14} /> Add phrase
                    </button>
                  ) : null}
                </div>
              </div>

              <div>
                <label className="label" htmlFor="intro">
                  Intro · {watched.intro.length}/400
                </label>
                <textarea
                  id="intro"
                  className="field min-h-28"
                  maxLength={400}
                  {...form.register("intro")}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
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
                </div>
                <div>
                  <label className="label" htmlFor="availabilityLabel">
                    Availability label
                  </label>
                  <input
                    id="availabilityLabel"
                    className="field"
                    maxLength={120}
                    {...form.register("availabilityLabel")}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Toggle
                  checked={watched.isAvailable}
                  onChange={(value) =>
                    form.setValue("isAvailable", value, { shouldDirty: true })
                  }
                  label="Available for work"
                />
                <span className="text-sm text-[#cbd8e8]">
                  {watched.isAvailable
                    ? "Availability badge is shown"
                    : "Availability badge is hidden"}
                </span>
              </div>
            </div>
          </Card>

          <Card title="stats">
            <div className="space-y-2">
              {stats.fields.map((field, index) => (
                <div key={field.id} className="flex flex-wrap gap-2">
                  <input
                    className="field sm:max-w-[120px]"
                    maxLength={12}
                    placeholder="5+"
                    aria-label="Stat value"
                    {...form.register(`stats.${index}.value`)}
                  />
                  <input
                    className="field min-w-0 flex-1"
                    maxLength={30}
                    placeholder="Years experience"
                    aria-label="Stat label"
                    {...form.register(`stats.${index}.label`)}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost !px-2"
                    aria-label="Remove stat"
                    onClick={() => stats.remove(index)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {stats.fields.length < 4 ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => stats.append({ value: "", label: "" })}
                >
                  <Plus size={14} /> Add stat
                </button>
              ) : null}
            </div>
          </Card>

          <Card title="socials">
            <div className="space-y-2">
              {socials.fields.map((field, index) => (
                <div key={field.id} className="flex flex-wrap gap-2">
                  <select
                    className="field sm:max-w-[140px]"
                    aria-label="Platform"
                    {...form.register(`socials.${index}.platform`)}
                  >
                    {PLATFORMS.map((platform) => (
                      <option key={platform} value={platform}>
                        {platform}
                      </option>
                    ))}
                  </select>
                  <input
                    className="field min-w-0 flex-1"
                    placeholder="https:// or mailto:"
                    aria-label="URL"
                    {...form.register(`socials.${index}.url`)}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost !px-2"
                    aria-label="Remove social"
                    onClick={() => socials.remove(index)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => socials.append({ platform: "github", url: "" })}
              >
                <Plus size={14} /> Add social
              </button>
            </div>
          </Card>
        </div>

        <div className="space-y-3">
          <div className="sticky top-20">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#5f7189]">
              Live preview
            </div>
            <article className="window-card p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#3b82f6]">
                {watched.location || "Location"}
              </div>
              <h2 className="mt-2 font-grotesk text-2xl font-bold leading-tight text-white">
                {watched.nameParts.filter(Boolean).join(" ") || "Your name"}
              </h2>
              <p className="mt-1 font-mono text-xs text-[#f0a500]">
                {watched.typingPhrases.find((phrase) => phrase.trim()) ||
                  "Your typing phrase"}
                <span className="animate-pulse">_</span>
              </p>
              <p className="mt-3 text-xs leading-relaxed text-[#8fa1b8]">
                {watched.intro || "Your intro appears here."}
              </p>
              {watched.isAvailable ? (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {watched.availabilityLabel || "Available"}
                </div>
              ) : null}
              {watched.stats.length > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {watched.stats.map((stat, index) => (
                    <div key={index} className="rounded-lg border border-white/10 p-2">
                      <div className="font-grotesk text-lg font-bold text-white">
                        {stat.value || "—"}
                      </div>
                      <div className="text-[10px] text-[#7c8fa6]">{stat.label}</div>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2 font-mono text-[10px] text-[#9db0c6]">
                {watched.socials.map((social, index) => (
                  <span key={index} className="rounded border border-white/10 px-2 py-0.5">
                    {social.platform}
                  </span>
                ))}
              </div>
            </article>
          </div>
        </div>
      </div>
    </>
  );
}

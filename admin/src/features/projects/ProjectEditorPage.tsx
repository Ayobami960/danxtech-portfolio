import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ExternalLink, Save, Trash2, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  useCreateProjectMutation,
  useDeleteGalleryImageMutation,
  useGetProjectQuery,
  useReorderGalleryMutation,
  useUpdateProjectMutation,
} from "../../api/adminApi";
import { errorMessage, getFieldErrors } from "../../api/errors";
import { resolveMediaUrl } from "../../app/config";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { Card } from "../../components/Card";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ColorField, EmojiField, TagInput } from "../../components/Fields";
import { PageHeader } from "../../components/PageHeader";
import { SortableList } from "../../components/SortableList";
import { ErrorState, LoadingList } from "../../components/States";
import { projectSchema, type ProjectForm } from "../../lib/schemas";
import { useUnsavedWarning } from "../../lib/useUnsavedWarning";
import { ACCEPT_IMAGES } from "../uploads/accept";
import { FileDropzone } from "../uploads/FileDropzone";
import { cancelUpload, uploadFile } from "../uploads/uploadFile";
import { uploadsSelectors } from "../uploads/uploadsSlice";

const DEFAULT_VALUES: ProjectForm = {
  title: "",
  description: "",
  icon: "🚀",
  accentColor: "#3b82f6",
  tech: [],
  stats: [],
  liveUrl: "",
  githubUrl: "",
  published: false,
};

export default function ProjectEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const project = useGetProjectQuery(id ?? "", { skip: isNew });
  const [create, createState] = useCreateProjectMutation();
  const [update, updateState] = useUpdateProjectMutation();
  const [reorderGallery] = useReorderGalleryMutation();
  const [deleteImage] = useDeleteGalleryImageMutation();
  const [removingImage, setRemovingImage] = useState<string | null>(null);
  const uploads = useAppSelector((state) => uploadsSelectors.selectAll(state.uploads));

  const form = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const stats = useFieldArray({ control: form.control, name: "stats" as never });
  const watched = form.watch();
  useUnsavedWarning(form.formState.isDirty);

  useEffect(() => {
    if (!project.data) return;
    form.reset({
      title: project.data.title,
      description: project.data.description,
      icon: project.data.icon,
      accentColor: project.data.accentColor,
      tech: project.data.tech,
      stats: project.data.stats,
      liveUrl: project.data.liveUrl ?? "",
      githubUrl: project.data.githubUrl ?? "",
      published: project.data.published,
    });
  }, [project.data, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const payload = {
      ...values,
      liveUrl: values.liveUrl.trim() === "" ? null : values.liveUrl.trim(),
      githubUrl: values.githubUrl.trim() === "" ? null : values.githubUrl.trim(),
    };
    try {
      if (isNew) {
        const created = await create(payload).unwrap();
        toast.success("Project created — add images next");
        navigate(`/projects/${created.id}`, { replace: true });
      } else if (id) {
        await update({ id, patch: payload }).unwrap();
        toast.success("Project saved");
        form.reset(values);
      }
    } catch (error) {
      const fields = getFieldErrors(error);
      for (const [path, message] of Object.entries(fields)) {
        form.setError(path as keyof ProjectForm, { message });
      }
      toast.error(errorMessage(error, "Could not save the project."));
    }
  });

  if (!isNew && project.isLoading) return <LoadingList rows={6} />;
  if (!isNew && project.error)
    return <ErrorState error={project.error} onRetry={project.refetch} />;

  const coverUploads = uploads.filter(
    (entry) => entry.kind === "cover" && entry.targetId === id,
  );
  const galleryUploads = uploads.filter(
    (entry) => entry.kind === "gallery" && entry.targetId === id,
  );
  const gallery = project.data?.gallery ?? [];
  const resolve = resolveMediaUrl;

  return (
    <>
      <PageHeader
        eyebrow={isNew ? "Projects" : project.data?.slug}
        title={isNew ? "New project" : watched.title || "Edit project"}
        description={
          isNew
            ? "Save a draft first — cover and gallery images can be added afterwards."
            : "Changes appear on the public site within about a minute."
        }
        actions={
          <>
            <Link to="/projects" className="btn btn-ghost">
              <ArrowLeft size={15} /> Back
            </Link>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void onSubmit()}
              disabled={createState.isLoading || updateState.isLoading}
            >
              <Save size={15} />
              {createState.isLoading || updateState.isLoading ? "Saving…" : "Save"}
            </button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card title="project_fields">
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div>
                <label className="label" htmlFor="title">
                  Title
                </label>
                <input id="title" className="field" maxLength={80} {...form.register("title")} />
                {form.formState.errors.title ? (
                  <p className="mt-1 text-xs text-red-300">
                    {form.formState.errors.title.message}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="label" htmlFor="description">
                  Description · {watched.description?.length ?? 0}/600
                </label>
                <textarea
                  id="description"
                  className="field min-h-28"
                  maxLength={600}
                  {...form.register("description")}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <span className="label">Icon</span>
                  <EmojiField
                    value={watched.icon}
                    onChange={(value) =>
                      form.setValue("icon", value, { shouldDirty: true })
                    }
                  />
                </div>
                <div>
                  <span className="label">Accent colour</span>
                  <ColorField
                    value={watched.accentColor}
                    onChange={(value) =>
                      form.setValue("accentColor", value, { shouldDirty: true })
                    }
                  />
                </div>
              </div>

              <div>
                <span className="label">Tech stack · max 15</span>
                <TagInput
                  value={watched.tech}
                  max={15}
                  maxLength={40}
                  onChange={(value) => form.setValue("tech", value, { shouldDirty: true })}
                />
              </div>

              <div>
                <span className="label">Stats · max 6</span>
                <div className="space-y-2">
                  {stats.fields.map((field, index) => (
                    <div key={field.id} className="flex gap-2">
                      <input
                        className="field"
                        maxLength={60}
                        placeholder="e.g. 500+ listings"
                        {...form.register(`stats.${index}`)}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost !px-2"
                        aria-label="Remove stat"
                        onClick={() => stats.remove(index)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {stats.fields.length < 6 ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => stats.append("" as never)}
                    >
                      Add stat
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="liveUrl">
                    Live URL (https)
                  </label>
                  <input
                    id="liveUrl"
                    className="field"
                    placeholder="https://"
                    {...form.register("liveUrl")}
                  />
                  {form.formState.errors.liveUrl ? (
                    <p className="mt-1 text-xs text-red-300">
                      {form.formState.errors.liveUrl.message}
                    </p>
                  ) : null}
                </div>
                <div>
                  <label className="label" htmlFor="githubUrl">
                    GitHub URL (https)
                  </label>
                  <input
                    id="githubUrl"
                    className="field"
                    placeholder="https://"
                    {...form.register("githubUrl")}
                  />
                  {form.formState.errors.githubUrl ? (
                    <p className="mt-1 text-xs text-red-300">
                      {form.formState.errors.githubUrl.message}
                    </p>
                  ) : null}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-[#cbd8e8]">
                <input type="checkbox" {...form.register("published")} />
                Published (visible on the public site)
              </label>
            </form>
          </Card>

          {!isNew && id ? (
            <>
              <Card title="cover_image">
                {project.data?.coverImage ? (
                  <img
                    src={resolve(project.data.coverImage) ?? ""}
                    alt="Project cover"
                    className="mb-3 h-48 w-full rounded-xl border border-white/10 object-cover"
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                    }}
                  />
                ) : null}
                <FileDropzone
                  accept={ACCEPT_IMAGES}
                  maxSizeBytes={25 * 1024 * 1024}
                  label="Drop a cover image (JPEG, PNG, WebP, GIF, AVIF · max 25 MB)"
                  hint="Replacing the cover removes the previous file."
                  onFiles={(files) => {
                    const file = files[0];
                    if (!file) return;
                    void dispatch(uploadFile({ file, kind: "cover", targetId: id }))
                      .unwrap()
                      .then(() => toast.success("Cover updated"))
                      .catch((error: unknown) => toast.error(errorMessage(error)));
                  }}
                />
                {coverUploads.map((entry) => (
                  <div key={entry.id} className="mt-2 rounded-lg border border-white/10 p-2">
                    <div className="flex justify-between text-[11px] text-[#9db0c6]">
                      <span className="truncate">{entry.name}</span>
                      <span>{entry.progress}%</span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded bg-white/10">
                      <div
                        className="h-full bg-[#3b82f6]"
                        style={{ width: `${entry.progress}%` }}
                      />
                    </div>
                    {entry.status === "uploading" ? (
                      <button
                        type="button"
                        className="mt-1 text-[10px] text-red-300"
                        onClick={() => cancelUpload(entry.id)}
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                ))}
              </Card>

              <Card title={`gallery_${gallery.length}/10`}>
                <FileDropzone
                  accept={ACCEPT_IMAGES}
                  multiple
                  maxSizeBytes={25 * 1024 * 1024}
                  label="Drop gallery images (JPEG, PNG, WebP, GIF, AVIF · max 25 MB each)"
                  hint="Up to 10 images total"
                  disabled={gallery.length >= 10}
                  onFiles={(files) => {
                    const room = Math.max(0, 10 - gallery.length);
                    for (const file of files.slice(0, room)) {
                      void dispatch(uploadFile({ file, kind: "gallery", targetId: id }))
                        .unwrap()
                        .catch((error: unknown) => toast.error(errorMessage(error)));
                    }
                    if (files.length > room) {
                      toast.error("Only 10 gallery images are allowed.");
                    }
                  }}
                />
                {galleryUploads.length > 0 ? (
                  <div className="mt-3 space-y-1.5">
                    {galleryUploads.map((entry) => (
                      <div key={entry.id} className="rounded-lg border border-white/10 p-2">
                        <div className="flex justify-between text-[11px] text-[#9db0c6]">
                          <span className="truncate">{entry.name}</span>
                          <span>{entry.progress}%</span>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded bg-white/10">
                          <div
                            className="h-full bg-[#3b82f6]"
                            style={{ width: `${entry.progress}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {gallery.length > 0 ? (
                  <div className="mt-4">
                    <SortableList
                      items={gallery.map((image) => ({
                        id: image.id,
                        node: (
                          <div className="flex items-center gap-3">
                            <img
                              src={resolve(image.url) ?? ""}
                              alt=""
                              className="h-12 w-16 rounded border border-white/10 object-cover"
                              onError={(event) => {
                                event.currentTarget.hidden = true;
                              }}
                            />
                            <span className="font-mono text-[10px] text-[#5f7189]">
                              #{image.sortOrder + 1}
                            </span>
                            <button
                              type="button"
                              className="ml-auto rounded p-1 text-[#7c8fa6] hover:bg-red-500/10 hover:text-red-300"
                              aria-label="Delete image"
                              onClick={() => setRemovingImage(image.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ),
                      }))}
                      onReorder={(ids) => {
                        void reorderGallery({ id, ids })
                          .unwrap()
                          .catch((error: unknown) => toast.error(errorMessage(error)));
                      }}
                    />
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-[#5f7189]">
                    No gallery images yet. The project card still works without them.
                  </p>
                )}
              </Card>
            </>
          ) : (
            <Card title="uploads">
              <p className="text-sm text-[#7c8fa6]">
                <Upload size={14} className="mr-1 inline" />
                Save the project first, then cover and gallery uploads become available.
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <div className="sticky top-20 space-y-3">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5f7189]">
              Live preview
            </div>
            <article
              className="window-card overflow-hidden"
              style={{ borderColor: `${watched.accentColor}44` }}
            >
              <div className="h-28 bg-[#0a0f1e]">
                {project.data?.coverImage ? (
                  <img
                    src={resolve(project.data.coverImage) ?? ""}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                    }}
                  />
                ) : (
                  <div
                    className="flex h-full items-center justify-center text-4xl"
                    style={{ background: `${watched.accentColor}18` }}
                  >
                    {watched.icon}
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{watched.icon}</span>
                  <h3 className="font-grotesk font-semibold text-white">
                    {watched.title || "Project title"}
                  </h3>
                </div>
                <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-[#8fa1b8]">
                  {watched.description || "Your project description will appear here."}
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {watched.tech.slice(0, 6).map((tech) => (
                    <span
                      key={tech}
                      className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[9px] text-[#9db0c6]"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
                {watched.stats.filter(Boolean).length > 0 ? (
                  <ul className="mt-3 space-y-1">
                    {watched.stats.filter(Boolean).map((stat) => (
                      <li key={stat} className="text-[11px] text-[#8fa1b8]">
                        <span style={{ color: watched.accentColor }}>▹</span> {stat}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-3 flex gap-3 text-[11px]">
                  {watched.liveUrl ? (
                    <span className="inline-flex items-center gap-1 text-[#3b82f6]">
                      Live demo <ExternalLink size={11} />
                    </span>
                  ) : null}
                  {watched.githubUrl ? <span className="text-[#9db0c6]">GitHub</span> : null}
                </div>
              </div>
            </article>
            <p className="text-[11px] text-[#5f7189]">
              Preview updates as you type. Images appear after upload.
            </p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(removingImage)}
        title="Delete this gallery image?"
        description="The file is removed from storage and cannot be recovered."
        onClose={() => setRemovingImage(null)}
        onConfirm={() => {
          if (!id || !removingImage) return;
          void deleteImage({ id, imageId: removingImage })
            .unwrap()
            .then(() => {
              setRemovingImage(null);
              toast.success("Image deleted");
            })
            .catch((error: unknown) => toast.error(errorMessage(error)));
        }}
      />
    </>
  );
}

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, ExternalLink, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  useAddProjectGalleryMutation,
  useCreateProjectMutation,
  useDeleteGalleryImageMutation,
  useGetProjectQuery,
  useReorderGalleryMutation,
  useSetProjectCoverMutation,
  useUpdateProjectMutation,
} from "../../api/adminApi";
import { errorMessage, getFieldErrors } from "../../api/errors";
import { resolveMediaUrl } from "../../utils/config";
import { Card } from "../../components/Card";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import {
  ColorField,
  EmojiField,
  TECH_SUGGESTIONS,
  TagInput,
  Toggle,
} from "../../components/Fields";
import { PageHeader } from "../../components/PageHeader";
import { SortableList } from "../../components/SortableList";
import { ErrorState, LoadingList } from "../../components/States";
import { UploadDrop } from "../../components/UploadDrop";
import { cn } from "../../lib/cn";
import {
  COMPLETENESS_CHECKS,
  completenessHint,
  completenessScore,
  type CompletenessInput,
} from "../../lib/completeness";
import { projectSchema, type ProjectForm } from "../../lib/schemas";
import { useUnsavedWarning } from "../../lib/useUnsavedWarning";
import {
  deleteFromCloudinary,
  MAX_UPLOAD_BYTES,
  uploadToCloudinary,
} from "../../lib/cloudinary";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const PDF_TYPES = ["application/pdf"] as const;
const SCORE_CIRCUMFERENCE = 226.2; // r=36

/** Matches MAX_UPLOAD_BYTES in lib/cloudinary: the helper rejects anything above. */
const IMAGE_UPLOAD_MAX_BYTES = MAX_UPLOAD_BYTES;
const DOCUMENT_MAX_BYTES = MAX_UPLOAD_BYTES;
const MAX_GALLERY_IMAGES = 10;

const formatBytes = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

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
  const project = useGetProjectQuery(id ?? "", { skip: isNew });
  const [create, createState] = useCreateProjectMutation();
  const [update, updateState] = useUpdateProjectMutation();
  const [setCover, setCoverState] = useSetProjectCoverMutation();
  const [addGallery, addGalleryState] = useAddProjectGalleryMutation();
  const [reorderGallery] = useReorderGalleryMutation();
  const [deleteImage] = useDeleteGalleryImageMutation();

  const [removingImage, setRemovingImage] = useState<string | null>(null);
  const [removingDocument, setRemovingDocument] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [coverProgress, setCoverProgress] = useState(0);
  const [galleryProgress, setGalleryProgress] = useState(0);
  const [documentProgress, setDocumentProgress] = useState(0);

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

  const uploading =
    uploadingCover || uploadingGallery || uploadingDocument || setCoverState.isLoading;

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
        return;
      }
      if (!id) return;
      const updated = await update({ id, patch: payload }).unwrap();
      toast.success("Project saved");
      form.reset({
        title: updated.title,
        description: updated.description,
        icon: updated.icon,
        accentColor: updated.accentColor,
        tech: updated.tech,
        stats: updated.stats,
        liveUrl: updated.liveUrl ?? "",
        githubUrl: updated.githubUrl ?? "",
        published: updated.published,
      });
    } catch (error) {
      const fields = getFieldErrors(error);
      for (const [path, message] of Object.entries(fields)) {
        form.setError(path as keyof ProjectForm, { message });
      }
      toast.error(errorMessage(error, "Could not save the project."));
    }
  });

  /**
   * Every upload below is browser -> Cloudinary: first `POST /uploads/sign`, then
   * the file goes straight to Cloudinary. Only `{ url, publicId }` is sent to the
   * API, so no upload passes through the backend's request-body limit.
   */
  const attachCover = async (file: File): Promise<void> => {
    if (!id) return;
    setUploadingCover(true);
    setCoverProgress(0);
    let uploaded: { url: string; publicId: string } | null = null;
    try {
      uploaded = await uploadToCloudinary(file, "cover", setCoverProgress);
      await setCover({ id, url: uploaded.url, publicId: uploaded.publicId }).unwrap();
      toast.success("Cover updated");
    } catch (error) {
      // The upload can succeed while the save fails; discard the orphan.
      if (uploaded) {
        await deleteFromCloudinary(uploaded.publicId).catch(() => undefined);
      }
      toast.error(errorMessage(error, "Could not upload the cover image."));
    } finally {
      setUploadingCover(false);
    }
  };

  const attachGallery = async (files: File[]): Promise<void> => {
    if (!id) return;
    setUploadingGallery(true);
    setGalleryProgress(0);
    const uploaded: Array<{ url: string; publicId: string }> = [];
    try {
      for (const file of files) {
        const result = await uploadToCloudinary(file, "gallery", setGalleryProgress);
        uploaded.push({ url: result.url, publicId: result.publicId });
      }
      await addGallery({ id, results: uploaded }).unwrap();
      toast.success("Gallery updated");
    } catch (error) {
      await Promise.all(
        uploaded.map((item) =>
          deleteFromCloudinary(item.publicId).catch(() => undefined),
        ),
      );
      toast.error(errorMessage(error, "Could not upload the gallery images."));
    } finally {
      setUploadingGallery(false);
    }
  };

  const attachDocument = async (file: File): Promise<void> => {
    if (!id) return;
    setUploadingDocument(true);
    setDocumentProgress(0);
    try {
      // The `resume` preset overwrites one fixed public_id, so a failed attach
      // must never delete it: that object may be the live site resume.
      const result = await uploadToCloudinary(file, "resume", setDocumentProgress);
      await update({
        id,
        patch: {
          document: {
            url: result.url,
            publicId: result.publicId,
            name: file.name,
            sizeBytes: file.size,
          },
        },
      }).unwrap();
      toast.success("PDF attached to the project");
    } catch (error) {
      toast.error(errorMessage(error, "Could not upload the PDF."));
    } finally {
      setUploadingDocument(false);
    }
  };

  if (!isNew && project.isLoading) return <LoadingList rows={6} />;
  if (!isNew && project.error)
    return <ErrorState error={project.error} onRetry={project.refetch} />;

  const gallery = project.data?.gallery ?? [];
  const resolve = resolveMediaUrl;
  const saving = createState.isLoading || updateState.isLoading;
  const dirty = form.formState.isDirty;
  const errors = form.formState.errors;

  const scoreInput: CompletenessInput = {
    title: watched.title ?? "",
    description: watched.description ?? "",
    tech: watched.tech ?? [],
    stats: watched.stats ?? [],
    liveUrl: watched.liveUrl,
    githubUrl: watched.githubUrl,
    hasCover: Boolean(project.data?.coverImage),
    galleryCount: gallery.length,
    hasDocument: Boolean(project.data?.document),
  };
  const score = completenessScore(scoreInput);
  const saveLabel = saving
    ? "Saving…"
    : uploading
      ? "Uploading…"
      : isNew
        ? "Save draft"
        : "Save changes";
  const statList = (watched.stats ?? []).filter((stat) => stat && stat.trim());

  return (
    <div className=" pb-28">
      <PageHeader
        back={
          <Link to="/projects" className="back">
            <ChevronLeft size={14} /> Projects
            {project.data?.slug ? <span>/ {project.data.slug}</span> : null}
          </Link>
        }
        title={watched.title?.trim() || (isNew ? "New project" : "Edit project")}
        description={
          isNew
            ? "Save a draft first. Cover, PDF and gallery images can be added afterwards."
            : "Changes appear on your public site within about a minute."
        }
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void onSubmit()}
            disabled={saving || uploading}
          >
            {saveLabel}
          </button>
        }
      />

      <div className="cols">
        <div className="stack">
          <Card title="Project details" meta="project_fields">
            <form onSubmit={onSubmit} className="form-stack" noValidate>
              <div>
                <label className="label" htmlFor="title">
                  Title
                </label>
                <input
                  id="title"
                  className={cn("field", errors.title && "is-invalid")}
                  maxLength={80}
                  placeholder="Name your project"
                  aria-invalid={Boolean(errors.title)}
                  {...form.register("title")}
                />
                {errors.title ? <p className="field-error">{errors.title.message}</p> : null}
              </div>

              <div>
                <label className="label" htmlFor="description">
                  Description <em>{watched.description?.length ?? 0}/600</em>
                </label>
                <textarea
                  id="description"
                  className="field"
                  maxLength={600}
                  placeholder="What does it do, and for whom?"
                  {...form.register("description")}
                />
              </div>

              <div className="two">
                <div>
                  <span className="label">Icon</span>
                  <EmojiField
                    value={watched.icon}
                    onChange={(value) => form.setValue("icon", value, { shouldDirty: true })}
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
                <div className="label">
                  <span>Tech stack</span>
                  <em>{watched.tech.length}/15</em>
                </div>
                <TagInput
                  value={watched.tech}
                  max={15}
                  maxLength={40}
                  suggestions={TECH_SUGGESTIONS}
                  onChange={(value) => form.setValue("tech", value, { shouldDirty: true })}
                />
              </div>

              <div>
                <div className="label">
                  <span>Stats</span>
                  <em>{stats.fields.length}/6</em>
                </div>
                {stats.fields.map((field, index) => (
                  <div key={field.id} className="srow">
                    <input
                      className="field"
                      maxLength={60}
                      placeholder="e.g. 500+ listings"
                      aria-label={`Stat ${index + 1}`}
                      {...form.register(`stats.${index}`)}
                    />
                    <button
                      type="button"
                      className="ib"
                      aria-label="Remove stat"
                      onClick={() => stats.remove(index)}
                    >
                      <X />
                    </button>
                  </div>
                ))}
                {stats.fields.length < 6 ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => stats.append("" as never)}
                  >
                    + Add stat
                  </button>
                ) : null}
              </div>

              <div className="two">
                <div>
                  <label className="label" htmlFor="liveUrl">
                    Live URL
                  </label>
                  <input
                    id="liveUrl"
                    className={cn("field", errors.liveUrl && "is-invalid")}
                    placeholder="https://"
                    aria-invalid={Boolean(errors.liveUrl)}
                    {...form.register("liveUrl")}
                  />
                  {errors.liveUrl ? (
                    <p className="field-error">{errors.liveUrl.message}</p>
                  ) : null}
                </div>
                <div>
                  <label className="label" htmlFor="githubUrl">
                    GitHub URL
                  </label>
                  <input
                    id="githubUrl"
                    className={cn("field", errors.githubUrl && "is-invalid")}
                    placeholder="https://"
                    aria-invalid={Boolean(errors.githubUrl)}
                    {...form.register("githubUrl")}
                  />
                  {errors.githubUrl ? (
                    <p className="field-error">{errors.githubUrl.message}</p>
                  ) : null}
                </div>
              </div>

              <div className="pubrow">
                <Toggle
                  id="published"
                  label="Published"
                  checked={Boolean(watched.published)}
                  onChange={(value) => form.setValue("published", value, { shouldDirty: true })}
                />
                <div>
                  Published
                  <small>Visible on your public site</small>
                </div>
              </div>
            </form>
          </Card>

          {!isNew && id ? (
            <>
              <Card title="Cover image" meta="cover_image">
                <div className="form-stack" style={{ gap: 14 }}>
                  {project.data?.coverImage ? (
                    <div className="cvp">
                      <img
                        src={resolve(project.data.coverImage) ?? ""}
                        alt="Project cover"
                        onError={(event) => {
                          event.currentTarget.hidden = true;
                        }}
                      />
                      <i>Current cover</i>
                    </div>
                  ) : null}
                  <UploadDrop
                    accept={IMAGE_TYPES}
                    maxSizeBytes={IMAGE_UPLOAD_MAX_BYTES}
                    label={
                      project.data?.coverImage ? "Drop a replacement cover" : "Drop a cover image"
                    }
                    hint="JPEG, PNG or WebP, up to 5 MB. Replacing removes the previous file."
                    disabled={uploadingCover || setCoverState.isLoading}
                    uploading={uploadingCover || setCoverState.isLoading}
                    progress={coverProgress}
                    onFiles={(files) => {
                      const file = files[0];
                      if (file) void attachCover(file);
                    }}
                  />
                </div>
              </Card>

              <Card title="Project document" meta="project_document">
                <div className="form-stack" style={{ gap: 0 }}>
                  {project.data?.document ? (
                    <div className="chip">
                      <div className="pf">PDF</div>
                      <div>
                        <b>{project.data.document.name}</b>
                        <small>{formatBytes(project.data.document.sizeBytes)}</small>
                      </div>
                      <a
                        href={project.data.document.url}
                        target="_blank"
                        rel="noreferrer"
                        className="ib"
                        aria-label="Open document"
                        title="Open"
                      >
                        <ExternalLink />
                      </a>
                      <button
                        type="button"
                        className="ib d"
                        aria-label="Remove document"
                        title="Remove"
                        onClick={() => setRemovingDocument(true)}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  ) : (
                    <p className="none" style={{ margin: "0 0 14px" }}>
                      No PDF attached. Link a case study or one-pager to this project.
                    </p>
                  )}
                  <UploadDrop
                    accept={PDF_TYPES}
                    maxSizeBytes={DOCUMENT_MAX_BYTES}
                    label={
                      project.data?.document ? "Drop a replacement PDF" : "Drop a project PDF"
                    }
                    hint="PDF only, up to 5 MB."
                    disabled={uploadingDocument}
                    uploading={uploadingDocument}
                    progress={documentProgress}
                    onFiles={(files) => {
                      const file = files[0];
                      if (file) void attachDocument(file);
                    }}
                  />
                </div>
              </Card>

              <Card title="Gallery" meta={`gallery_${gallery.length}/${MAX_GALLERY_IMAGES}`}>
                <UploadDrop
                  accept={IMAGE_TYPES}
                  multiple
                  maxSizeBytes={IMAGE_UPLOAD_MAX_BYTES}
                  label="Drop gallery images"
                  hint={`JPEG, PNG or WebP, up to 5 MB each. Up to ${MAX_GALLERY_IMAGES} images.`}
                  disabled={
                    gallery.length >= MAX_GALLERY_IMAGES ||
                    uploadingGallery ||
                    addGalleryState.isLoading
                  }
                  uploading={uploadingGallery || addGalleryState.isLoading}
                  progress={galleryProgress}
                  onFiles={(files) => {
                    const room = Math.max(0, MAX_GALLERY_IMAGES - gallery.length);
                    if (files.length > room) {
                      toast.error(`Only ${MAX_GALLERY_IMAGES} gallery images are allowed.`);
                      return;
                    }
                    void attachGallery(files);
                  }}
                />

                {gallery.length > 0 ? (
                  <div className="mt-4">
                    <SortableList
                      variant="gallery"
                      items={gallery.map((image) => ({
                        id: image.id,
                        label: `Reorder image ${image.sortOrder + 1}`,
                        node: (
                          <>
                            <img
                              src={resolve(image.url) ?? ""}
                              alt=""
                              className="gt"
                              onError={(event) => {
                                event.currentTarget.hidden = true;
                              }}
                            />
                            <span className="gname">Image {image.sortOrder + 1}</span>
                            <button
                              type="button"
                              className="ib d"
                              aria-label={`Delete image ${image.sortOrder + 1}`}
                              onClick={() => setRemovingImage(image.id)}
                            >
                              <Trash2 />
                            </button>
                          </>
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
                  <p className="none">
                    No gallery images yet. The project card still works without them.
                  </p>
                )}
              </Card>
            </>
          ) : (
            <div className="lock">
              <div style={{ fontSize: "1.6rem" }} aria-hidden>
                🔒
              </div>
              <div>
                <b>Uploads unlock after the first save</b>
                Save the project first, then the cover, PDF and gallery uploads become available.
              </div>
            </div>
          )}
        </div>

        <aside className="side-col">
          <div>
            <p className="cap">Live preview</p>
            <article className="pv" style={{ borderColor: `${watched.accentColor}55` }}>
              <div
                className="cv"
                style={{
                  background: project.data?.coverImage ? undefined : `${watched.accentColor}22`,
                }}
              >
                {project.data?.coverImage ? (
                  <img
                    src={resolve(project.data.coverImage) ?? ""}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                    }}
                  />
                ) : (
                  watched.icon
                )}
              </div>
              <div className="pb">
                <h3>
                  <span>{watched.icon}</span>
                  <span>{watched.title || "Project title"}</span>
                  <span className={cn("pill sm", watched.published && "live")}>
                    {watched.published ? "Live" : "Draft"}
                  </span>
                </h3>
                <p>{watched.description || "Your project description will appear here."}</p>
                <div className="tg">
                  {watched.tech.slice(0, 6).map((tech) => (
                    <span key={tech}>{tech}</span>
                  ))}
                </div>
                {statList.length > 0 ? (
                  <ul>
                    {statList.map((stat, index) => (
                      <li key={`${stat}-${index}`}>
                        <span style={{ color: watched.accentColor }}>▹</span> {stat}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="lk">
                  {watched.liveUrl ? <span>Live demo ↗</span> : null}
                  {watched.githubUrl ? <span>GitHub</span> : null}
                </div>
              </div>
            </article>
          </div>

          <section className="card score">
            <div className="sc">
              <div className="sr2">
                <svg viewBox="0 0 84 84" aria-hidden>
                  <circle cx="42" cy="42" r="36" fill="none" stroke="var(--line2)" strokeWidth="6" />
                  <circle
                    className="sarc"
                    cx="42"
                    cy="42"
                    r="36"
                    fill="none"
                    stroke="var(--acc)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={SCORE_CIRCUMFERENCE}
                    strokeDashoffset={SCORE_CIRCUMFERENCE * (1 - score / 100)}
                    transform="rotate(-90 42 42)"
                  />
                </svg>
                <b>{score}</b>
              </div>
              <div>
                <strong>Completeness</strong>
                <p>{completenessHint(score)}</p>
              </div>
            </div>
            <ul className="cl">
              {COMPLETENESS_CHECKS.map((check) => {
                const ok = check.passed(scoreInput);
                return (
                  <li key={check.label} className={ok ? "ok" : undefined}>
                    <i>✓</i>
                    {check.label}
                    <em>+{check.weight}</em>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>

      <div className={cn("floatbar unsaved", dirty && "on")} role="region" aria-label="Unsaved changes">
        <b>Unsaved changes</b>
        <button type="button" onClick={() => form.reset()} disabled={saving}>
          Discard
        </button>
        <button
          type="button"
          className="sv"
          onClick={() => void onSubmit()}
          disabled={saving || uploading}
        >
          {saveLabel}
        </button>
      </div>

      <ConfirmDialog
        open={removingDocument}
        title="Remove the project PDF?"
        description="The file is removed from storage and cannot be recovered."
        confirmLabel="Remove PDF"
        busy={updateState.isLoading}
        onClose={() => setRemovingDocument(false)}
        onConfirm={() => {
          if (!id) return;
          void update({ id, patch: { document: null } })
            .unwrap()
            .then(() => {
              setRemovingDocument(false);
              toast.success("Document removed");
            })
            .catch((error: unknown) => toast.error(errorMessage(error)));
        }}
      />

      <ConfirmDialog
        open={Boolean(removingImage)}
        title="Delete this gallery image?"
        description="The file is removed from storage and cannot be recovered."
        confirmLabel="Delete image"
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
    </div>
  );
}

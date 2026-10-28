import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  useDeleteProjectMutation,
  useFeatureProjectMutation,
  useGetProjectsQuery,
  useReorderProjectsMutation,
  useUpdateProjectMutation,
} from "../../api/adminApi";
import type { Project } from "../../api/types";
import { errorMessage } from "../../api/errors";
import { resolveMediaUrl } from "../../app/config";
import { useAppSelector } from "../../app/hooks";
import { Card } from "../../components/Card";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Toggle } from "../../components/Fields";
import { PageHeader } from "../../components/PageHeader";
import { SortableList } from "../../components/SortableList";
import { EmptyState, ErrorState, LoadingList, Pagination } from "../../components/States";
import { relativeTime } from "../../lib/format";

export default function ProjectsPage() {
  const navigate = useNavigate();
  const page = useAppSelector((state) => state.ui.projectPage);
  const query = useGetProjectsQuery({ page, pageSize: 100 });
  const [updateProject] = useUpdateProjectMutation();
  const [featureProject] = useFeatureProjectMutation();
  const [reorder] = useReorderProjectsMutation();
  const [remove, removeState] = useDeleteProjectMutation();
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [featuring, setFeaturing] = useState<Project | null>(null);

  const featured = query.data?.data.find((project) => project.featured) ?? null;

  const togglePublished = async (project: Project, published: boolean): Promise<void> => {
    try {
      await updateProject({ id: project.id, patch: { published } }).unwrap();
      toast.success(published ? "Project published" : "Project moved to draft");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const feature = async (project: Project): Promise<void> => {
    try {
      await featureProject(project.id).unwrap();
      setFeaturing(null);
      toast.success(`“${project.title}” is now featured`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Projects"
        description="Drag to reorder. One project can be featured; publishing shows it on the public site."
        actions={
          <Link to="/projects/new" className="btn btn-primary">
            <Plus size={15} /> New project
          </Link>
        }
      />

      {query.isLoading ? (
        <LoadingList rows={5} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : query.data && query.data.data.length > 0 ? (
        <Card bodyClassName="p-3">
          <SortableList
            items={query.data.data.map((project) => ({
              id: project.id,
              node: (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-[#0a0f1e]">
                    {project.coverImage ? (
                      <img
                        src={resolveMediaUrl(project.coverImage) ?? ""}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.hidden = true;
                        }}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xl">
                        {project.icon}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="truncate text-left font-medium text-white hover:text-[#93c5fd]"
                        onClick={() => navigate(`/projects/${project.id}`)}
                      >
                        {project.title}
                      </button>
                      {project.featured ? (
                        <span className="rounded-full border border-[#f0a500]/30 bg-[#f0a500]/10 px-1.5 py-0.5 font-mono text-[9px] uppercase text-[#f0a500]">
                          featured
                        </span>
                      ) : null}
                    </div>
                    <div className="font-mono text-[10px] text-[#5f7189]">
                      {project.slug} · {project.gallery.length} image(s) ·{" "}
                      {relativeTime(project.updatedAt)}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-[11px] text-[#7c8fa6]">
                    <Toggle
                      checked={project.published}
                      onChange={(value) => void togglePublished(project, value)}
                      label={`Publish ${project.title}`}
                    />
                    {project.published ? "Published" : "Draft"}
                  </label>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-[#7c8fa6] hover:bg-white/5 hover:text-[#f0a500]"
                    aria-label={`Feature ${project.title}`}
                    onClick={() => {
                      if (project.featured) return;
                      if (featured && featured.id !== project.id) setFeaturing(project);
                      else void feature(project);
                    }}
                  >
                    <Star
                      size={15}
                      className={project.featured ? "fill-[#f0a500] text-[#f0a500]" : ""}
                    />
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-[#7c8fa6] hover:bg-white/5 hover:text-white"
                    aria-label={`Edit ${project.title}`}
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-[#7c8fa6] hover:bg-red-500/10 hover:text-red-300"
                    aria-label={`Delete ${project.title}`}
                    onClick={() => setDeleting(project)}
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
          <Pagination
            page={page}
            pageSize={100}
            total={query.data.meta.total}
            onPage={() => undefined}
          />
        </Card>
      ) : (
        <EmptyState
          title="No projects yet"
          description="Create your first project. It can stay a draft until it is ready."
          action={
            <Link to="/projects/new" className="btn btn-primary">
              New project
            </Link>
          }
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete “${deleting?.title ?? ""}”?`}
        description="The project and its uploaded images are removed permanently."
        busy={removeState.isLoading}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          void remove(deleting.id)
            .unwrap()
            .then(() => {
              toast.success("Project deleted");
              setDeleting(null);
            })
            .catch((error: unknown) => toast.error(errorMessage(error)));
        }}
      />

      <ConfirmDialog
        open={Boolean(featuring)}
        title="Replace the featured project?"
        description={`“${featured?.title ?? "Another project"}” will stop being featured. Only one project can be featured.`}
        confirmLabel="Feature this project"
        onClose={() => setFeaturing(null)}
        onConfirm={() => {
          if (featuring) void feature(featuring);
        }}
      />
    </>
  );
}

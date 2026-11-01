import { Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
import { useAppSelector } from "../../store/hooks";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { Toggle } from "../../components/Fields";
import { PageHeader } from "../../components/PageHeader";
import { SortableList } from "../../components/SortableList";
import { EmptyState, ErrorState, LoadingList, Pagination } from "../../components/States";
import { completenessScore } from "../../lib/completeness";
import { cn } from "../../lib/cn";
import { relativeTime } from "../../lib/format";

type Filter = "all" | "live" | "draft";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "draft", label: "Drafts" },
];

const scoreOf = (project: Project): number =>
  completenessScore({
    title: project.title,
    description: project.description,
    tech: project.tech,
    stats: project.stats,
    liveUrl: project.liveUrl,
    githubUrl: project.githubUrl,
    hasCover: Boolean(project.coverImage),
    galleryCount: project.gallery.length,
    hasDocument: Boolean(project.document),
  });

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

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const projects = useMemo<Project[]>(() => query.data?.data ?? [], [query.data]);
  const featured = projects.find((project) => project.featured) ?? null;

  const scores = useMemo(() => {
    const map = new Map<string, number>();
    for (const project of projects) map.set(project.id, scoreOf(project));
    return map;
  }, [projects]);

  const liveCount = projects.filter((project) => project.published).length;
  const averageScore =
    projects.length > 0
      ? Math.round(
          projects.reduce((sum, project) => sum + (scores.get(project.id) ?? 0), 0) /
            projects.length,
        )
      : 0;

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return projects.filter(
      (project) =>
        (filter === "all" || (filter === "live") === project.published) &&
        (!needle || `${project.title} ${project.slug}`.toLowerCase().includes(needle)),
    );
  }, [projects, filter, search]);

  const canSort = filter === "all" && search.trim() === "";

  // Selection only ever refers to projects that still exist.
  const selectedIds = useMemo(
    () => projects.filter((project) => selected.has(project.id)).map((project) => project.id),
    [projects, selected],
  );
  const selectedVisible = visible.filter((project) => selected.has(project.id)).length;

  const allBox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (allBox.current) {
      allBox.current.indeterminate =
        selectedVisible > 0 && selectedVisible < visible.length;
    }
  }, [selectedVisible, visible.length]);

  const toggleSelected = (id: string, on: boolean): void =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const toggleAll = (on: boolean): void =>
    setSelected((current) => {
      const next = new Set(current);
      for (const project of visible) {
        if (on) next.add(project.id);
        else next.delete(project.id);
      }
      return next;
    });

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

  /** Runs one request per selected project and reports how many succeeded. */
  const runBulk = async (
    ids: string[],
    action: (id: string) => Promise<unknown>,
    done: (ok: number) => string,
  ): Promise<void> => {
    setBulkBusy(true);
    const results = await Promise.allSettled(ids.map((id) => action(id)));
    setBulkBusy(false);
    const succeeded = ids.filter((_, index) => results[index]?.status === "fulfilled");
    const failed = results.find((result) => result.status === "rejected");
    setSelected((current) => {
      const next = new Set(current);
      for (const id of succeeded) next.delete(id);
      return next;
    });
    if (succeeded.length > 0) toast.success(done(succeeded.length));
    if (failed && failed.status === "rejected") toast.error(errorMessage(failed.reason));
  };

  const bulkPublish = (published: boolean): void => {
    const ids = projects
      .filter((project) => selected.has(project.id) && project.published !== published)
      .map((project) => project.id);
    if (ids.length === 0) {
      toast.message(published ? "Already published" : "Already drafts");
      return;
    }
    void runBulk(
      ids,
      (id) => updateProject({ id, patch: { published } }).unwrap(),
      (ok) => `${ok} project${ok === 1 ? "" : "s"} ${published ? "published" : "moved to draft"}`,
    );
  };

  return (
    <>
      <PageHeader
        title="Projects"
        description="Drag to reorder. One project can be featured; publishing shows it on the public site."
      />

      {query.isLoading ? (
        <LoadingList rows={5} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : projects.length > 0 ? (
        <section className="panel">
          <div className="stats">
            <div className="st">
              <small>Projects</small>
              <b>{projects.length}</b>
            </div>
            <div className="st">
              <small>Live</small>
              <b>{liveCount}</b>
            </div>
            <div className="st">
              <small>Drafts</small>
              <b>{projects.length - liveCount}</b>
            </div>
            <div className="st">
              <small>Completeness</small>
              <b>
                {averageScore}
                <i>%</i>
              </b>
            </div>
          </div>

          <div className="tool">
            <label className="ck" title="Select all">
              <input
                ref={allBox}
                type="checkbox"
                aria-label="Select all projects"
                checked={visible.length > 0 && selectedVisible === visible.length}
                onChange={(event) => toggleAll(event.target.checked)}
              />
              <i />
            </label>
            <div
              className="seg"
              role="group"
              aria-label="Filter"
              style={
                {
                  "--n": FILTERS.length,
                  "--i": FILTERS.findIndex((item) => item.key === filter),
                } as CSSProperties
              }
            >
              {FILTERS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={filter === item.key}
                  onClick={() => setFilter(item.key)}
                >
                  {item.label}
                  <em>
                    {item.key === "all"
                      ? projects.length
                      : item.key === "live"
                        ? liveCount
                        : projects.length - liveCount}
                  </em>
                </button>
              ))}
            </div>
            <label className="search">
              <Search size={14} aria-hidden />
              <input
                type="search"
                value={search}
                placeholder="Search projects"
                aria-label="Search projects"
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <Link to="/projects/new" className="btn btn-primary">
              <Plus size={15} /> New project
            </Link>
          </div>

          {visible.length > 0 ? (
            <SortableList
              variant="project"
              disabled={!canSort}
              items={visible.map((project) => ({
                id: project.id,
                label: `Reorder ${project.title}`,
                className: cn(selected.has(project.id) && "sel", project.featured && "feat"),
                node: (
                  <>
                    <label className="ck">
                      <input
                        type="checkbox"
                        checked={selected.has(project.id)}
                        aria-label={`Select ${project.title}`}
                        onChange={(event) => toggleSelected(project.id, event.target.checked)}
                      />
                      <i />
                    </label>
                    <div
                      className="rg"
                      style={
                        {
                          "--c": project.accentColor,
                          "--s": scores.get(project.id) ?? 0,
                        } as CSSProperties
                      }
                      title={`${scores.get(project.id) ?? 0}% complete`}
                    >
                      <span>{project.icon}</span>
                    </div>
                    <div className="inf">
                      <button
                        type="button"
                        className="ttl"
                        onClick={() => navigate(`/projects/${project.id}`)}
                      >
                        {project.title}
                      </button>
                      <small>
                        /{project.slug} · {project.gallery.length} img ·{" "}
                        {relativeTime(project.updatedAt)}
                      </small>
                    </div>
                    {project.featured ? <span className="pill feat">★ Featured</span> : null}
                    <span className={cn("pill", project.published && "live")}>
                      {project.published ? "Live" : "Draft"}
                    </span>
                    <Toggle
                      small
                      checked={project.published}
                      onChange={(value) => void togglePublished(project, value)}
                      label={`Publish ${project.title}`}
                    />
                    <div className="flex">
                      <button
                        type="button"
                        className={cn("ib s", project.featured && "on")}
                        aria-label={`Feature ${project.title}`}
                        title="Feature"
                        onClick={() => {
                          if (project.featured) return;
                          if (featured && featured.id !== project.id) setFeaturing(project);
                          else void feature(project);
                        }}
                      >
                        <Star />
                      </button>
                      <button
                        type="button"
                        className="ib"
                        aria-label={`Edit ${project.title}`}
                        title="Edit"
                        onClick={() => navigate(`/projects/${project.id}`)}
                      >
                        <Pencil />
                      </button>
                      <button
                        type="button"
                        className="ib d"
                        aria-label={`Delete ${project.title}`}
                        title="Delete"
                        onClick={() => setDeleting(project)}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </>
                ),
              }))}
              onReorder={(ids) => {
                void reorder(ids)
                  .unwrap()
                  .catch((error: unknown) => toast.error(errorMessage(error)));
              }}
            />
          ) : (
            <div className="empty">
              <b>No projects match</b>
              Try another filter or search.
            </div>
          )}

          <Pagination
            page={page}
            pageSize={100}
            total={query.data?.meta.total ?? projects.length}
            onPage={() => undefined}
          />

          <div className="hint">
            <span>
              <kbd>Space</kbd>pick up, <kbd>↑↓</kbd>move, <kbd>Space</kbd>drop
            </span>
            {!canSort ? <span>Clear the filter and search to reorder.</span> : null}
          </div>
        </section>
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

      <div
        className={cn("floatbar", selectedIds.length > 0 && "on")}
        role="toolbar"
        aria-label="Bulk actions"
      >
        <b>{selectedIds.length} selected</b>
        <button type="button" disabled={bulkBusy} onClick={() => bulkPublish(true)}>
          Publish
        </button>
        <button type="button" disabled={bulkBusy} onClick={() => bulkPublish(false)}>
          Unpublish
        </button>
        <button type="button" className="x" disabled={bulkBusy} onClick={() => setBulkDeleting(true)}>
          Delete
        </button>
        <button type="button" aria-label="Clear selection" onClick={() => setSelected(new Set())}>
          ✕
        </button>
      </div>

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
        open={bulkDeleting}
        title={`Delete ${selectedIds.length} project${selectedIds.length === 1 ? "" : "s"}?`}
        description="The selected projects and their uploaded images are removed permanently."
        busy={bulkBusy}
        onClose={() => setBulkDeleting(false)}
        onConfirm={() => {
          void runBulk(
            selectedIds,
            (id) => remove(id).unwrap(),
            (ok) => `${ok} project${ok === 1 ? "" : "s"} deleted`,
          ).then(() => setBulkDeleting(false));
        }}
      />

      <ConfirmDialog
        open={Boolean(featuring)}
        title="Replace the featured project?"
        description={`“${featured?.title ?? "Another project"}” will stop being featured. Only one project can be featured.`}
        confirmLabel="Feature this project"
        tone="primary"
        onClose={() => setFeaturing(null)}
        onConfirm={() => {
          if (featuring) void feature(featuring);
        }}
      />
    </>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Animated from "../ui/AnimatedSection";
import SectionHeader from "../ui/SectionHeader";
import SpotlightCard from "../ui/SpotlightCard";
import ProjectGalleryModal, { type GalleryProject } from "../ProjectGalleryModal";
import { ExternalLink, Images, ArrowUpRight } from "lucide-react";
import { FaGithub } from "react-icons/fa6";
import type { PublicProject } from "../../lib/api";

export type { PublicProject as ProjectItem };


const cover = (p: PublicProject) => p.imageParent ?? p.imageBox[0] ?? null;

const toGallery = (p: PublicProject): GalleryProject => {
  const c = cover(p);
  return {
    title: p.title,
    icon: p.icon,
    accentColor: p.accentColor,
    imageBox: p.imageBox.length ? p.imageBox : c ? [c] : [],
    imageParent: c ?? undefined,
    description: p.description,
    tech: p.tech,
    liveUrl: p.liveUrl ?? undefined,
    githubUrl: p.githubUrl ?? undefined,
  };
};

/* Cover image that opens the gallery (or a placeholder if there is none) */
function ProjectMedia({
  project,
  onOpen,
  zoomClass = "group-hover/img:scale-105",
  badge = "corner",
  priority = false,
}: {
  project: PublicProject;
  onOpen: () => void;
  zoomClass?: string;
  badge?: "corner" | "pill";
  /** Above-the-fold cover: load eagerly and hint the browser. */
  priority?: boolean;
}) {
  const src = cover(project);
  const count = project.imageBox.length;
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex aspect-video w-full items-center justify-center bg-[#0a1024]">
        <span className="text-5xl opacity-60">{project.icon}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${project.title} gallery`}
      className="group/img relative block w-full overflow-hidden text-left"
    >
      <img
        src={src}
        alt={`${project.title} — project cover`}
        width={1280}
        height={720}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        onError={() => setFailed(true)}
        className={`aspect-video w-full object-cover transition-transform duration-700 ${zoomClass}`}
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-300 group-hover/img:bg-black/40">
        <span className="inline-flex items-center gap-2 rounded-full bg-black/60 px-3.5! py-1.5! font-mono text-xs text-white opacity-0 backdrop-blur transition-opacity duration-300 group-hover/img:opacity-100">
          <Images size={13} /> View gallery{badge === "pill" && count > 1 ? ` · ${count}` : ""}
        </span>
      </div>
      {badge === "corner" && count > 1 && (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded bg-black/60 px-2! py-0.5! font-mono text-[10px] text-white">
          <Images size={10} /> {count}
        </span>
      )}
    </button>
  );
}


export default function ProjectsSection({ projects }: { projects: PublicProject[] }) {
  const all = projects;
  const featured = all.find((p) => p.featured);
  const rest = useMemo(() => all.filter((p) => !p.featured), [all]);

  /* Most common technologies across non-featured projects → filter chips */
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    rest.forEach((p) => p.tech.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [
      "All",
      ...[...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7)
        .map(([t]) => t),
    ];
  }, [rest]);

  const [filter, setFilter] = useState("All");
  const [active, setActive] = useState<PublicProject | null>(null);

  const activeFilter = tags.includes(filter) ? filter : "All";
  const visible = activeFilter === "All" ? rest : rest.filter((p) => p.tech.includes(activeFilter));

  return (
    <section id="projects" className="relative overflow-hidden bg-[#0e1528] py-28!">
      <style>{`
        @keyframes pj-in { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        .pj-in { animation: pj-in .5s cubic-bezier(.2,.8,.2,1) both; }
        @media (prefers-reduced-motion: reduce) { .pj-in { animation: none !important; } }
      `}</style>

      <div className="relative px-6! lg:px-16!">
        <SectionHeader
          index="06"
          tag="Work"
          title={
            <>
              Featured <span className="gradient-text">projects</span>
            </>
          }
          description="A selection of products I've built — from idea to production."
        />

        {all.length === 0 && (
          <p className="py-16! text-center font-mono text-sm text-[#7c8fa6]">
            Projects are coming soon.
          </p>
        )}

        {/* ============ FEATURED ============ */}
        {featured && (
          <Animated delay={100}>
            <div
              className="group relative mb-8! overflow-hidden rounded-3xl border border-white/10 p-6! transition-colors duration-300 hover:border-white/20 sm:p-8! lg:p-10!"
              style={{ background: "linear-gradient(135deg, #131c35 0%, #0e1528 100%)" }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                  background: `radial-gradient(circle at 85% 40%, ${featured.accentColor}22, transparent 60%)`,
                }}
              />

              <div className="relative grid items-center gap-10 lg:grid-cols-12">
                {/* image in a browser-style frame */}
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a1024] lg:col-span-7">
                  <div className="flex items-center gap-1.5 border-b border-white/5 bg-[#131c35] px-4! py-2.5!">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ffbe2e]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#28c941]" />
                    <span className="ml-3 truncate font-mono text-[11px] text-[#7c8fa6]">
                      {featured.title}
                    </span>
                  </div>
                  <ProjectMedia
                    project={featured}
                    onOpen={() => setActive(featured)}
                    zoomClass="group-hover/img:scale-[1.03]"
                    badge="pill"
                    priority
                  />
                </div>

                {/* content */}
                <div className="lg:col-span-5">
                  <div className="mb-5! inline-flex items-center gap-2 rounded-full border border-[#f0a500]/25 bg-[#f0a500]/10 px-3! py-1! font-mono text-xs uppercase tracking-wider text-[#f0a500]">
                    ★ Featured
                  </div>

                  <div className="mb-3! flex items-center gap-3">
                    <span className="text-4xl">{featured.icon}</span>
                    <h3 className="font-grotesk text-3xl font-bold text-white">{featured.title}</h3>
                  </div>

                  <p className="mb-5! leading-relaxed text-[#8fa1b8]">{featured.description}</p>

                  <div className="mb-6! flex flex-wrap gap-2">
                    {featured.tech.map((t) => (
                      <span
                        key={t}
                        className="rounded-md border border-white/8 bg-white/4 px-2.5! py-1! font-mono text-xs text-[#9db0c6]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  {featured.stats.length > 0 && (
                    <ul className="mb-7! flex flex-col gap-2">
                      {featured.stats.map((s) => (
                        <li key={s} className="flex items-start gap-2 font-mono text-sm text-[#10b981]">
                          <span>✓</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    {featured.liveUrl && (
                      <a
                        href={featured.liveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-grotesk group/btn inline-flex items-center gap-2 rounded-full bg-white py-2! pl-5! pr-2! font-semibold text-[#0a0f1e] transition-shadow hover:shadow-xl hover:shadow-blue-400/20"
                      >
                        Live demo
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-full text-white transition-transform duration-300 group-hover/btn:rotate-45"
                          style={{ background: featured.accentColor }}
                        >
                          <ArrowUpRight size={16} />
                        </span>
                      </a>
                    )}
                    {featured.githubUrl && (
                      <a
                        href={featured.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-grotesk inline-flex items-center gap-2 rounded-full border border-white/15 px-5! py-2.5! font-semibold text-white transition-colors hover:border-white/40"
                      >
                        <FaGithub size={15} /> Source
                      </a>
                    )}
                    <Link
                      href={`/projects/${featured.slug}`}
                      className="font-grotesk inline-flex items-center gap-2 rounded-full border border-white/15 px-5! py-2.5! font-semibold text-white transition-colors hover:border-white/40"
                    >
                      Case study <ArrowUpRight size={15} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </Animated>
        )}

        {/* ============ FILTERS ============ */}
        {rest.length > 0 && (
          <Animated delay={150}>
            <div
              className="mb-6! flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Filter projects"
            >
              <span className="mr-2 font-mono text-xs uppercase tracking-widest text-[#7c8fa6]">
                Filter
              </span>
              {tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilter(t)}
                  aria-pressed={activeFilter === t}
                  className={`rounded-full border px-3.5! py-1.5! font-mono text-xs transition-all duration-200 ${
                    activeFilter === t
                      ? "border-[#3b82f6] bg-[#3b82f6]/15 text-white"
                      : "border-white/10 bg-white/3 text-[#9db0c6] hover:border-white/25 hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </Animated>
        )}

        {/* ============ GRID ============ */}
        <div key={activeFilter} className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((project, i) => (
            <div key={project.id} className="pj-in" style={{ animationDelay: `${i * 70}ms` }}>
              <SpotlightCard
                glow={`${project.accentColor}26`}
                className="flex h-full flex-col rounded-2xl border border-white/8 bg-[#131c35] transition-all duration-300 hover:-translate-y-1 hover:border-white/20"
              >
                <ProjectMedia project={project} onOpen={() => setActive(project)} />

                <div className="flex flex-1 flex-col p-6!">
                  <div className="mb-3! flex items-center gap-3">
                    <span className="text-2xl">{project.icon}</span>
                    <h3 className="font-grotesk text-lg font-bold text-white">{project.title}</h3>
                  </div>

                  <p className="mb-4! flex-1 text-sm leading-relaxed text-[#8fa1b8]">
                    {project.description}
                  </p>

                  <div className="mb-5! flex flex-wrap gap-1.5">
                    {project.tech.map((t) => (
                      <span
                        key={t}
                        className={`rounded border px-2! py-0.5! font-mono text-[11px] ${
                          t === activeFilter
                            ? "border-[#3b82f6]/50 bg-[#3b82f6]/10 text-white"
                            : "border-white/6 bg-white/4 text-[#9db0c6]"
                        }`}
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  {(project.liveUrl || project.githubUrl) && (
                    <div className="mt-auto flex gap-5 border-t border-white/6 pt-4!">
                      {project.liveUrl && (
                        <a
                          href={project.liveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#3b82f6] transition-colors hover:text-blue-300"
                        >
                          <ExternalLink size={14} /> Demo
                        </a>
                      )}
                      {project.githubUrl && (
                        <a
                          href={project.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#8fa1b8] transition-colors hover:text-white"
                        >
                          <FaGithub size={14} /> Code
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </SpotlightCard>
            </div>
          ))}
        </div>

        {rest.length > 0 && visible.length === 0 && (
          <p className="py-10! text-center font-mono text-sm text-[#7c8fa6]">
            No other projects use {activeFilter} yet.
          </p>
        )}

        {all.length > 0 ? (
          <p className="mt-8! text-center font-mono text-xs text-[#7c8fa6]">
            Every card opens a case study with the full gallery:{" "}
            <Link href="/projects" className="text-[#3b82f6] hover:underline">
              browse all projects
            </Link>
            .
          </p>
        ) : null}
      </div>

      {active && <ProjectGalleryModal project={toGallery(active)} onClose={() => setActive(null)} />}
    </section>
  );
}
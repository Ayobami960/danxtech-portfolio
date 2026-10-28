import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { FaGithub } from "react-icons/fa6";
import EmptySection from "@/components/ui/EmptySection";
import SectionError from "@/components/ui/SectionError";
import { errorMessage, fetchProjects } from "@/lib/api";
import type { PublicProject } from "@/lib/api";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Projects — Adetoye Daniel Kehinde",
  description:
    "Case studies of products I have designed and shipped: architecture, trade-offs and screenshots.",
};

const cover = (project: PublicProject): string | null =>
  project.imageParent ?? project.imageBox[0] ?? null;

export default async function ProjectsPage() {
  let projects: PublicProject[];

  try {
    projects = await fetchProjects();
  } catch (error) {
    return (
      <main className="min-h-screen bg-[#0a0f1e] px-6! pt-24! pb-20! lg:px-16!">
        <SectionError title="Projects could not load" message={errorMessage(error)} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0f1e] px-6! pt-24! pb-20! lg:px-16!">
      <Link
        href="/"
        className="inline-flex items-center gap-2 font-mono text-xs text-[#7c8fa6] transition-colors hover:text-white"
      >
        <ArrowLeft size={14} /> Back to portfolio
      </Link>

      <header className="mt-6 max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#3b82f6]">Work</p>
        <h1 className="font-grotesk mt-3 text-4xl font-bold text-white sm:text-5xl">
          Projects
        </h1>
        <p className="mt-4 leading-relaxed text-[#8fa1b8]">
          A selection of products I have built — from idea to production.
        </p>
      </header>

      {projects.length === 0 ? (
        <EmptySection
          label="Projects"
          message="No projects have been published yet. They will appear here as soon as they are live."
        />
      ) : (
        <ul className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const src = cover(project);
            return (
              <li key={project.id}>
                <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#131c35] transition-colors hover:border-white/25">
                  <Link href={`/projects/${project.slug}`} className="block">
                    {src ? (
                      <img
                        src={src}
                        alt={`${project.title} — project cover`}
                        width={1280}
                        height={720}
                        loading="lazy"
                        decoding="async"
                        className="aspect-video w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-video w-full items-center justify-center bg-[#0a1024] text-5xl">
                        <span aria-hidden>{project.icon}</span>
                      </div>
                    )}
                  </Link>

                  <div className="flex flex-1 flex-col p-6!">
                    <h2 className="font-grotesk text-lg font-bold text-white">
                      <Link href={`/projects/${project.slug}`} className="hover:text-[#93c5fd]">
                        {project.title}
                      </Link>
                    </h2>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-[#8fa1b8]">
                      {project.description}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {project.tech.slice(0, 5).map((tech) => (
                        <span
                          key={tech}
                          className="rounded border border-white/8 bg-white/4 px-2! py-0.5! font-mono text-[11px] text-[#9db0c6]"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>

                    <div className="mt-5 flex items-center gap-4 border-t border-white/6 pt-4! text-sm">
                      <Link
                        href={`/projects/${project.slug}`}
                        className="inline-flex items-center gap-1.5 font-medium text-[#3b82f6] hover:text-blue-300"
                      >
                        Case study <ArrowUpRight size={14} />
                      </Link>
                      {project.githubUrl ? (
                        <a
                          href={project.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[#8fa1b8] hover:text-white"
                        >
                          <FaGithub size={14} /> Code
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

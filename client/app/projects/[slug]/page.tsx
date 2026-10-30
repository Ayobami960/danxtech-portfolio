import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, ExternalLink } from "lucide-react";
import { FaGithub } from "react-icons/fa6";
import ProjectGallery from "@/components/projects/ProjectGallery";
import ProjectImage from "@/components/ui/ProjectImage";
import SectionError from "@/components/ui/SectionError";
import { isApiError, errorMessage, fetchProject } from "@/lib/api";
import type { PublicProject } from "@/lib/api";

export const revalidate = 60;

type PageProps = { params: Promise<{ slug: string }> };

const loadProject = async (slug: string): Promise<PublicProject | "not-found" | "error"> => {
  try {
    return await fetchProject(slug);
  } catch (error) {
    if (isApiError(error) && error.status === 404) return "not-found";
    return "error";
  }
};

export const generateMetadata = async ({
  params,
}: PageProps): Promise<Metadata> => {
  const { slug } = await params;
  const project = await loadProject(slug);

  if (project === "not-found" || project === "error") {
    return { title: "Project — Adetoye Daniel Kehinde" };
  }

  const cover = project.imageParent ?? project.imageBox[0] ?? null;

  return {
    title: `${project.title} — Adetoye Daniel Kehinde`,
    description: project.description,
    openGraph: {
      title: project.title,
      description: project.description,
      type: "article",
      ...(cover ? { images: [{ url: cover, alt: `${project.title} cover` }] } : {}),
    },
  };
};

export default async function ProjectPage({ params }: PageProps) {
  const { slug } = await params;
  const project = await loadProject(slug);

  if (project === "not-found") notFound();

  if (project === "error") {
    return (
      <main className="min-h-screen bg-[#0a0f1e] px-6! pt-24! pb-20! lg:px-16!">
        <SectionError
          title="This project could not load"
          message={errorMessage(new Error("The project is temporarily unavailable."))}
        />
      </main>
    );
  }

  const cover = project.imageParent ?? project.imageBox[0] ?? null;
  const galleryCount = project.imageBox.length;

  return (
    <main className="min-h-screen bg-[#0a0f1e] px-6! pt-24! pb-20! lg:px-16!">
      <Link
        href="/projects"
        className="inline-flex items-center gap-2 font-mono text-xs text-[#7c8fa6] transition-colors hover:text-white"
      >
        <ArrowLeft size={14} /> All projects
      </Link>

      <header className="mt-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <span aria-hidden className="text-4xl">
            {project.icon}
          </span>
          <h1 className="font-grotesk text-3xl font-bold text-white sm:text-4xl">
            {project.title}
          </h1>
        </div>

        <p className="mt-4 text-lg leading-relaxed text-[#c3d0e0]">{project.description}</p>

        <div className="mt-5 flex flex-wrap gap-2">
          {project.tech.map((tech) => (
            <span
              key={tech}
              className="rounded-md border border-white/8 bg-white/4 px-2.5! py-1! font-mono text-xs text-[#9db0c6]"
            >
              {tech}
            </span>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {project.liveUrl ? (
            <a
              href={project.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-grotesk inline-flex items-center gap-2 rounded-full bg-white py-2! pl-5! pr-2! font-semibold text-[#0a0f1e] transition-shadow hover:shadow-xl hover:shadow-blue-400/20"
            >
              Live demo
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-white"
                style={{ background: project.accentColor }}
              >
                <ArrowUpRight size={16} />
              </span>
            </a>
          ) : null}
          {project.githubUrl ? (
            <a
              href={project.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-grotesk inline-flex items-center gap-2 rounded-full border border-white/15 px-5! py-2.5! font-semibold text-white transition-colors hover:border-white/40"
            >
              <FaGithub size={15} /> Source
            </a>
          ) : null}
        </div>
      </header>

      {cover ? (
        <figure className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-[#0a1024]">
          <ProjectImage
            src={cover}
            alt={`${project.title} cover`}
            icon={project.icon}
            width={1600}
            height={900}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="aspect-video w-full object-cover"
          />
        </figure>
      ) : null}

      {project.stats.length > 0 ? (
        <section className="mt-10" aria-labelledby="highlights">
          <h2 id="highlights" className="font-grotesk text-xl font-bold text-white">
            Highlights
          </h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {project.stats.map((stat) => (
              <li
                key={stat}
                className="flex items-start gap-2 rounded-xl border border-white/8 bg-white/3 px-4! py-3! text-sm text-[#c3d0e0]"
              >
                <span aria-hidden className="text-[#10b981]">
                  ✓
                </span>
                {stat}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-12" aria-labelledby="gallery">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id="gallery" className="font-grotesk text-xl font-bold text-white">
            Gallery
          </h2>
          <span className="font-mono text-xs text-[#7c8fa6]">
            {galleryCount} image{galleryCount === 1 ? "" : "s"}
          </span>
        </div>
        <ProjectGallery project={project} />
      </section>

      {project.liveUrl ? (
        <p className="mt-12 border-t border-white/8 pt-6">
          <a
            href={project.liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-medium text-[#3b82f6] hover:text-blue-300"
          >
            <ExternalLink size={15} /> Visit {project.title}
          </a>
        </p>
      ) : null}
    </main>
  );
}

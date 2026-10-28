"use client";

import { useState } from "react";
import ProjectGalleryModal, {
  type GalleryProject,
} from "@/components/ProjectGalleryModal";
import type { PublicProject } from "@/lib/api";

/**
 * Gallery for the project detail page: a responsive grid that opens the
 * existing lightbox at the clicked image. Plain <img> keeps ImageKit's own
 * optimization in charge (no double processing) while width/height reserve
 * space and lazy loading defers off-screen shots.
 */
export default function ProjectGallery({ project }: { project: PublicProject }) {
  const images = project.imageBox.length
    ? project.imageBox
    : project.imageParent
      ? [project.imageParent]
      : [];
  const [openAt, setOpenAt] = useState<number | null>(null);

  const gallery: GalleryProject = {
    title: project.title,
    icon: project.icon,
    accentColor: project.accentColor,
    imageBox: images,
    imageParent: project.imageParent ?? undefined,
    description: project.description,
    tech: project.tech,
    liveUrl: project.liveUrl ?? undefined,
    githubUrl: project.githubUrl ?? undefined,
  };

  if (images.length === 0) {
    return (
      <p className="rounded-2xl border border-white/10 bg-white/3 px-6! py-10! text-center font-mono text-sm text-[#7c8fa6]">
        No screenshots have been published for this project yet.
      </p>
    );
  }

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((src, index) => (
          <li key={`${src}-${index}`}>
            <button
              type="button"
              onClick={() => setOpenAt(index)}
              className="group relative block w-full overflow-hidden rounded-xl border border-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b82f6]"
              aria-label={`Open screenshot ${index + 1} of ${images.length}`}
            >
              <img
                src={src}
                alt={`${project.title} screenshot ${index + 1}`}
                width={800}
                height={450}
                loading="lazy"
                decoding="async"
                className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            </button>
          </li>
        ))}
      </ul>

      {openAt !== null ? (
        <ProjectGalleryModal
          project={gallery}
          startIndex={openAt}
          onClose={() => setOpenAt(null)}
        />
      ) : null}
    </>
  );
}

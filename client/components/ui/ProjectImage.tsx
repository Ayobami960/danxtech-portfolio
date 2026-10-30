"use client";

import { useState, type ImgHTMLAttributes } from "react";

/**
 * Media image with a graceful failure state.
 *
 * Stored URLs are rendered exactly as the API returns them (no rewriting), so
 * this only covers the case where the object itself cannot be served: a deleted
 * Cloudinary object, a legacy ImageKit row whose URL no longer resolves, or a
 * deployment still pointing at the old delivery domain. The project icon shows
 * instead of the browser's broken-image glyph.
 */
export default function ProjectImage({
  src,
  alt,
  icon,
  className,
  ...rest
}: {
  /** Absolute media URL, straight from the API. */
  src: string;
  alt: string;
  /** Fallback glyph (the project's emoji icon). */
  icon?: string;
} & Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "onError">) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex aspect-video w-full items-center justify-center bg-[#0a1024] ${className ?? ""}`}
        role="img"
        aria-label={alt}
      >
        <span aria-hidden className="text-4xl opacity-60">
          {icon ?? "🖼️"}
        </span>
      </div>
    );
  }

  return (
    <img
      {...rest}
      src={src}
      alt={alt}
      className={className}
      onError={() => {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`Media failed to load: ${src}`);
        }
        setFailed(true);
      }}
    />
  );
}

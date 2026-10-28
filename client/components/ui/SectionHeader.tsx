import type { ReactNode } from "react";
import Animated from "./AnimatedSection";

/**
 * Shared section heading, matches the hero's "01 — Portfolio" eyebrow.
 * Put in: components/ui/SectionHeader.tsx
 */
export default function SectionHeader({
  index,
  tag,
  title,
  description,
}: {
  index: string;
  tag: string;
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <Animated>
      <div className="mb-14!">
        <div className="mb-5! flex items-center gap-4 font-mono text-xs">
          <span className="text-[#3b82f6]">{index}</span>
          <span className="h-px w-10 bg-white/20" />
          <span className="uppercase tracking-[0.2em] text-[#7c8fa6]">{tag}</span>
        </div>

        <h2
          className="font-grotesk font-bold leading-[1.05] tracking-tight text-white"
          style={{ fontSize: "clamp(2.2rem, 5vw, 3.75rem)" }}
        >
          {title}
        </h2>

        {description && (
          <p className="mt-5! max-w-2xl text-base leading-relaxed text-[#8fa1b8] sm:text-lg">
            {description}
          </p>
        )}
      </div>
    </Animated>
  );
}
"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Search, X } from "lucide-react";
import Animated from "../ui/AnimatedSection";
import SectionHeader from "../ui/SectionHeader";
import SpotlightCard from "../ui/SpotlightCard";
import type { SkillGroup } from "../../lib/api";

/* One accent per category — gives the grid rhythm without inventing data */
const PALETTE = ["#3b82f6", "#8b5cf6", "#10b981", "#f0a500", "#f43f5e", "#06b6d4", "#ec4899", "#84cc16"];

type Chip = { item: string; color: string };

export default function SkillsSection({ groups }: { groups: SkillGroup[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const total = useMemo(
    () => groups.reduce((n, g) => n + g.items.length, 0),
    [groups]
  );

  const matchCount = useMemo(
    () =>
      q
        ? groups.reduce(
            (n, g) => n + g.items.filter((item) => item.toLowerCase().includes(q)).length,
            0
          )
        : total,
    [q, total, groups]
  );

  /* Two marquee rows built from every skill */
  const [rowA, rowB] = useMemo(() => {
    const all: Chip[] = groups.flatMap((g, gi) =>
      g.items.map((item) => ({ item, color: PALETTE[gi % PALETTE.length] }))
    );
    return [all.filter((_, i) => i % 2 === 0), all.filter((_, i) => i % 2 === 1)];
  }, [groups]);

  return (
    <section id="skills" className="relative overflow-hidden bg-[#0a0f1e] py-28!">
      <style>{`
        @keyframes sk-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .sk-track { animation: sk-marquee var(--dur, 40s) linear infinite; }
        .sk-track.rev { animation-direction: reverse; }
        .sk-marquee:hover .sk-track { animation-play-state: paused; }

        .sk-chip {
          border: 1px solid color-mix(in srgb, var(--c) 24%, transparent);
          background: color-mix(in srgb, var(--c) 8%, transparent);
          color: #c3d0e0;
          transition: transform .2s ease, border-color .2s ease, background .2s ease, color .2s ease, opacity .25s ease, box-shadow .2s ease;
        }
        .sk-chip:hover {
          transform: translateY(-2px);
          border-color: var(--c);
          background: color-mix(in srgb, var(--c) 18%, transparent);
          color: #fff;
        }
        .sk-chip[data-match="true"] {
          border-color: var(--c);
          background: color-mix(in srgb, var(--c) 24%, transparent);
          color: #fff;
          box-shadow: 0 0 18px -4px var(--c);
        }
        .sk-chip[data-dim="true"] { opacity: .22; }

        @media (prefers-reduced-motion: reduce) { .sk-track { animation: none !important; } }
      `}</style>

      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 bottom-0 h-150 w-150 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(139,92,246,.10), transparent 65%)",
          filter: "blur(80px)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-10 h-125 w-125 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(59,130,246,.09), transparent 65%)",
          filter: "blur(80px)",
        }}
      />

      <div className="relative px-6! lg:px-16!">
        <SectionHeader
          index="04"
          tag="Toolkit"
          title={
            <>
              Skills &amp; <span className="gradient-text">Technologies</span>
            </>
          }
          description="A full-spectrum toolkit — from interactive UIs to distributed backend systems and AI pipelines."
        />

        {/* ============ TOOLBAR ============ */}
        <Animated delay={80}>
          <div className="mb-8! flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative w-full sm:max-w-md">
              <span className="sr-only">Search skills</span>
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7c8fa6]"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setQuery("")}
                placeholder={`Search ${total} skills…`}
                className="w-full rounded-xl border border-white/10 bg-white/3 py-3! pl-11! pr-10! font-mono text-sm text-white outline-none backdrop-blur transition-all placeholder:text-white/25 focus:border-[#3b82f6]/60 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.12)]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1! text-[#7c8fa6] transition-colors hover:text-white"
                >
                  <X size={15} />
                </button>
              )}
            </label>

            <div className="font-mono text-xs text-[#7c8fa6]" aria-live="polite">
              {q ? (
                <>
                  <span className="text-white">{matchCount}</span> match{matchCount === 1 ? "" : "es"}
                </>
              ) : (
                <>
                  <span className="text-white">{total}</span> technologies across{" "}
                  <span className="text-white">{groups.length}</span> domains
                </>
              )}
            </div>
          </div>
        </Animated>

        {/* ============ CATEGORY GRID ============ */}
        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" }}
        >
          {groups.map((group, i) => {
            const color = PALETTE[i % PALETTE.length];
            const groupMatches = q
              ? group.items.filter((item) => item.toLowerCase().includes(q)).length
              : group.items.length;
            const faded = q && groupMatches === 0;

            return (
              <Animated key={group.title} delay={i * 60}>
                <SpotlightCard
                  glow={`${color}24`}
                  className={`h-full rounded-2xl border bg-[#0e1528] p-6! transition-all duration-300 hover:-translate-y-1 ${
                    faded ? "opacity-40" : ""
                  }`}
                  style={{ borderColor: `${color}2b` }}
                >
                  {/* top accent line */}
                  <div
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-px"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
                    }}
                  />

                  <div className="mb-5! flex items-center gap-3.5">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
                      style={{ background: `${color}18`, border: `1px solid ${color}33` }}
                    >
                      {group.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-grotesk text-lg font-bold leading-tight text-white">
                        {group.title}
                      </h3>
                      <div className="mt-1.5! h-0.5 w-8 rounded-full" style={{ background: color }} />
                    </div>
                    <span className="font-mono text-xs" style={{ color }}>
                      {q ? `${groupMatches}/` : ""}
                      {String(group.items.length).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {group.items.map((item) => {
                      const isMatch = !!q && item.toLowerCase().includes(q);
                      return (
                        <span
                          key={item}
                          data-match={isMatch}
                          data-dim={!!q && !isMatch}
                          className="sk-chip cursor-default rounded-lg px-3! py-1.5! font-mono text-[13px]"
                          style={{ "--c": color } as CSSProperties}
                        >
                          {item}
                        </span>
                      );
                    })}
                  </div>
                </SpotlightCard>
              </Animated>
            );
          })}
        </div>

        {q && matchCount === 0 && (
          <p className="mt-8! text-center font-mono text-sm text-[#7c8fa6]">
            No skills match “{query.trim()}”.
          </p>
        )}

        {/* ============ MARQUEE ============ */}
        <Animated delay={200}>
          <div className="mt-16!">
            <p className="mb-5! text-center font-mono text-[11px] uppercase tracking-[0.25em] text-[#7c8fa6]">
              The full stack, in motion
            </p>

            <div
              className="sk-marquee flex flex-col gap-3 overflow-hidden"
              style={{
                maskImage: "linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)",
                WebkitMaskImage:
                  "linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent)",
              }}
            >
              {[rowA, rowB].map((row, ri) => (
                <div
                  key={ri}
                  className={`sk-track flex w-max gap-3 ${ri === 1 ? "rev" : ""}`}
                  style={{ "--dur": `${Math.max(30, row.length * 2.4)}s` } as CSSProperties}
                >
                  {[...row, ...row].map((c, i) => (
                    <span
                      key={`${c.item}-${i}`}
                      aria-hidden={i >= row.length}
                      className="sk-chip whitespace-nowrap rounded-full px-4! py-2! font-mono text-xs"
                      style={{ "--c": c.color } as CSSProperties}
                    >
                      {c.item}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Animated>
      </div>
    </section>
  );
}
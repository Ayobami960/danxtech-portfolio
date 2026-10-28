"use client";

import { useState, type ReactNode } from "react";
import { GraduationCap, Shield, Code2, Award, ChevronDown } from "lucide-react";
import AnimatedSection from "@/components/ui/AnimatedSection";
import SectionHeader from "@/components/ui/SectionHeader";
import SpotlightCard from "@/components/ui/SpotlightCard";
import type { CredentialItem, ExperienceItem } from "@/lib/api";

type Exp = ExperienceItem;
type Filter = "all" | "engineering" | "security";

const GOLD = "#f0a500";
const GREEN = "#34d399";
const COLLAPSE_AFTER = 3;

/* ================================================================== */
/* Timeline row: meta on the left (sticky), rail + node, content right */
/* ================================================================== */
function TimelineRow({
  meta,
  color,
  current = false,
  last = false,
  children,
}: {
  meta: ReactNode;
  color: string;
  current?: boolean;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-x-10 md:grid-cols-[180px_minmax(0,1fr)]">
      {/* desktop meta */}
      <div className="hidden md:block">
        <div className="sticky top-28 pt-0.5">{meta}</div>
      </div>

      {/* rail + content */}
      <div className="relative pb-10! pl-8! md:pl-10!">
        <span
          aria-hidden
          className={`absolute left-0 top-2 w-px bg-linear-to-b from-white/20 to-white/5 ${
            last ? "bottom-10" : "bottom-0"
          }`}
        />
        <span
          aria-hidden
          className="absolute -left-1.25 top-2 flex h-2.75 w-2.75 items-center justify-center"
        >
          {current && (
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
              style={{ background: color }}
            />
          )}
          <span
            className="relative h-2.75 w-2.75 rounded-full"
            style={{ background: color, boxShadow: `0 0 12px ${color}99` }}
          />
        </span>

        {/* mobile meta */}
        <div className="mb-3! md:hidden">{meta}</div>

        {children}
      </div>
    </div>
  );
}

/* ================================================================== */
/* Experience card                                                     */
/* ================================================================== */
function ExperienceCard({ exp }: { exp: Exp }) {
  const [open, setOpen] = useState(false);
  const isSec = exp.type === "security";
  const Icon = isSec ? Shield : Code2;
  const hiddenCount = Math.max(exp.highlights.length - COLLAPSE_AFTER, 0);
  const shown = open ? exp.highlights : exp.highlights.slice(0, COLLAPSE_AFTER);

  return (
    <SpotlightCard
      glow={`${exp.color}22`}
      className="rounded-2xl border bg-[#131c35]/70 p-6! backdrop-blur transition-all duration-300 hover:-translate-y-0.5 sm:p-7!"
      style={{ borderColor: `${exp.color}2e` }}
    >
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${exp.color}, transparent)` }}
      />

      <div className="mb-5! flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-grotesk text-xl font-bold text-white sm:text-2xl">{exp.role}</h3>
          <div className="mt-1.5! font-mono text-sm" style={{ color: exp.color }}>
            {exp.company}
          </div>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3! py-1! font-mono text-[11px]"
          style={{
            color: exp.color,
            background: `${exp.color}14`,
            border: `1px solid ${exp.color}30`,
          }}
        >
          <Icon size={11} />
          {isSec ? "Security" : "Engineering"}
        </span>
      </div>

      <ul className="space-y-3">
        {shown.map((h, j) => (
          <li key={j} className="flex gap-3 text-sm leading-relaxed text-[#8fa1b8]">
            <span className="mt-0.5 shrink-0" style={{ color: exp.color }}>
              ▸
            </span>
            <span>{h}</span>
          </li>
        ))}
      </ul>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mt-5! inline-flex items-center gap-2 font-mono text-xs transition-colors hover:text-white"
          style={{ color: exp.color }}
        >
          {open ? "Show less" : `Show ${hiddenCount} more`}
          <ChevronDown
            size={14}
            className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          />
        </button>
      )}
    </SpotlightCard>
  );
}

/* ================================================================== */
/* Section                                                             */
/* ================================================================== */
export default function ExperienceSection({
  experience,
  credentials,
}: {
  experience: ExperienceItem[];
  credentials: CredentialItem[];
}) {
  const entries: ExperienceItem[] = experience;
  const degree = credentials.find((item) => item.kind === "degree") ?? null;
  const certifications = credentials.filter((item) => item.kind === "certification");
  const hasEducation = Boolean(degree) || certifications.length > 0;
  const [filter, setFilter] = useState<Filter>("all");

  const engCount = entries.filter((e) => e.type !== "security").length;
  const secCount = entries.filter((e) => e.type === "security").length;

  const FILTERS: { key: Filter; label: string; count: number; color: string; icon?: typeof Code2 }[] = [
    { key: "all", label: "All", count: entries.length, color: "#3b82f6" },
    { key: "engineering", label: "Engineering", count: engCount, color: "#4f8ef7", icon: Code2 },
    { key: "security", label: "Security", count: secCount, color: "#ef4444", icon: Shield },
  ];

  const visible = entries.filter((e) =>
    filter === "all" ? true : filter === "security" ? e.type === "security" : e.type !== "security"
  );
  const showEducation = filter === "all" && hasEducation;

  return (
    <section id="experience" className="relative overflow-hidden bg-[#0e1528] py-28!">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-1/3 h-150 w-150 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(79,142,247,.10), transparent 65%)",
          filter: "blur(90px)",
        }}
      />

      <div className="relative px-6! lg:px-16!">
        <SectionHeader
          index="03"
          tag="Career"
          title={
            <>
              Where I&apos;ve <span className="gradient-text">worked</span>
            </>
          }
          description="Engineering and security roles — two disciplines, one practitioner."
        />

        {/* ============ EMPTY ============ */}
        {entries.length === 0 && !hasEducation ? (
          <p className="py-16! text-center font-mono text-sm text-[#7c8fa6]">
            No experience entries yet — check back soon.
          </p>
        ) : null}

        {/* ============ FILTERS ============ */}
        {entries.length > 0 ? (
        <AnimatedSection delay={60}>
          <div className="mb-12! flex flex-wrap gap-3" role="group" aria-label="Filter experience">
            {FILTERS.map(({ key, label, count, color, icon: Icon }) => {
              const active = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  aria-pressed={active}
                  className="inline-flex items-center gap-2 rounded-full border px-4! py-2! font-mono text-xs transition-all duration-200"
                  style={{
                    color: active ? "#fff" : color,
                    background: active ? `${color}26` : `${color}0d`,
                    borderColor: active ? color : `${color}33`,
                  }}
                >
                  {Icon && <Icon size={12} />}
                  {label}
                  <span className="text-white/40">{String(count).padStart(2, "0")}</span>
                </button>
              );
            })}
          </div>
        </AnimatedSection>
        ) : null}

        {/* ============ TIMELINE ============ */}
        <div key={filter}>
          {visible.map((exp, i) => {
            const isLast = !showEducation && i === visible.length - 1;
            return (
              <AnimatedSection key={`${exp.role}-${exp.company}-${i}`} delay={i * 100}>
                <TimelineRow
                  color={exp.color}
                  current={!!exp.current}
                  last={isLast}
                  meta={
                    <div className="flex flex-row flex-wrap items-center gap-2 md:flex-col md:items-start">
                      <span className="font-mono text-sm text-[#c3d0e0]">{exp.period}</span>
                      {exp.current && (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5! py-0.5! font-mono text-[10px]"
                          style={{
                            color: GREEN,
                            background: "rgba(52,211,153,.1)",
                            border: "1px solid rgba(52,211,153,.25)",
                          }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{
                              background: GREEN,
                              animation: "dotPulse 2s ease-in-out infinite",
                            }}
                          />
                          Current
                        </span>
                      )}
                    </div>
                  }
                >
                  <ExperienceCard exp={exp} />
                </TimelineRow>
              </AnimatedSection>
            );
          })}

          {/* ============ EDUCATION ============ */}
          {showEducation && (
            <AnimatedSection delay={visible.length * 100}>
              <TimelineRow
                color={GOLD}
                last
                meta={
                  <span className="font-mono text-sm text-[#c3d0e0]">
                    {degree?.period ?? "Education"}
                  </span>
                }
              >
                <SpotlightCard
                  glow={`${GOLD}22`}
                  className="rounded-2xl border bg-[#131c35]/70 p-6! backdrop-blur transition-all duration-300 hover:-translate-y-0.5 sm:p-7!"
                  style={{ borderColor: `${GOLD}2e` }}
                >
                  <div
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-px"
                    style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }}
                  />

                  <div className="mb-5! flex items-start gap-4">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}33`, color: GOLD }}
                    >
                      <GraduationCap size={22} />
                    </div>
                    <div>
                      <h3 className="font-grotesk text-xl font-bold text-white sm:text-2xl">
                        {degree?.title ?? "Certifications"}
                      </h3>
                      {degree ? (
                        <div className="mt-1.5! font-mono text-sm" style={{ color: GOLD }}>
                          {degree.issuer}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {certifications.length > 0 && (
                    <>
                      <div className="mb-3! font-mono text-[11px] uppercase tracking-[0.2em] text-[#7c8fa6]">
                        Certifications
                      </div>
                      <ul className="grid gap-2.5">
                        {certifications.map((c) => (
                          <li
                            key={c.id}
                            className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/3 px-4! py-3!"
                          >
                            <Award size={16} className="mt-0.5 shrink-0" style={{ color: GOLD }} />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-white">{c.title}</div>
                              {[c.issuer, c.period].filter(Boolean).length > 0 && (
                                <div className="mt-0.5! break-words font-mono text-xs text-[#8fa1b8]">
                                  {[c.issuer, c.period].filter(Boolean).join(" · ")}
                                </div>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </SpotlightCard>
              </TimelineRow>
            </AnimatedSection>
          )}
        </div>
      </div>
    </section>
  );
}
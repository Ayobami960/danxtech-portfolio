"use client";

import AnimatedSection from "@/components/ui/AnimatedSection";
import SectionHeader from "@/components/ui/SectionHeader";
import SpotlightCard from "@/components/ui/SpotlightCard";
import type { SecurityContent } from "@/lib/api";
import { ShieldCheck, AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";

export default function SecuritySection({ security }: { security: SecurityContent }) {
  const focusAreas = security.focus;
  const owasp = security.owasp;
  const stats = security.stats;
  const covered = owasp.filter((i) => i.covered).length;
  const total = owasp.length;
  const pct = total ? Math.round((covered / total) * 100) : 0;

  return (
    <section id="security" className="relative overflow-hidden bg-[#0a0f1e] py-28!">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-20 h-150 w-150 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(239,68,68,.10), transparent 65%)",
          filter: "blur(90px)",
        }}
      />

      <div className="relative px-6! lg:px-16!">
        <SectionHeader
          index="05"
          tag="Cybersecurity"
          title={
            <>
              Application security &amp;{" "}
              <span
                style={{
                  background: "linear-gradient(135deg,#ef4444,#f97316)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                vulnerability analysis
              </span>
            </>
          }
          description="Beyond building software, I secure it. I identify weaknesses before attackers do — through systematic vulnerability analysis, application security reviews, and secure-by-design development practices."
        />

        {/* ============ STATS — scan summary ============ */}
        {stats.length > 0 ? (
        <AnimatedSection delay={80}>
          <div className="mb-8! overflow-hidden rounded-2xl border border-[#ef4444]/20 bg-[#ef4444]/4">
            <div className="flex items-center gap-2 border-b border-[#ef4444]/15 px-5! py-3! font-mono text-xs">
              <span className="h-2 w-2 rounded-full bg-[#ef4444]" />
              <span className="text-[#f0a500]">~/secops $</span>
              <span className="text-white">summary --all</span>
            </div>
            <div
              className="grid gap-4 p-5! sm:p-7!"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}
            >
              {stats.map((s) => (
                <div key={s.label} className="flex flex-col items-center gap-1.5 py-2! text-center">
                  <span className="text-2xl">{s.icon}</span>
                  <span className="font-grotesk text-3xl font-bold text-white sm:text-4xl">
                    {s.value}
                  </span>
                  <span className="font-mono text-xs text-[#8fa1b8]">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>
        ) : null}

        {/* ============ FOCUS AREAS ============ */}
        {focusAreas.length === 0 ? (
          <p className="mb-8! text-center font-mono text-sm text-[#7c8fa6]">
            Security focus areas are being updated — check back shortly.
          </p>
        ) : null}
        <div className="mb-8! grid gap-5 lg:grid-cols-2">
          {focusAreas.map((area, i) => (
            <AnimatedSection key={area.title} delay={i * 80}>
              <SpotlightCard
                glow={`${area.color}22`}
                className="h-full rounded-2xl border bg-[#0e1528] p-6! transition-all duration-300 hover:-translate-y-1 sm:p-7!"
                style={{ borderColor: `${area.color}2e` }}
              >
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-px"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${area.color}, transparent)`,
                  }}
                />

                <div className="mb-4! flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl"
                      style={{
                        background: `${area.color}18`,
                        border: `1px solid ${area.color}30`,
                      }}
                    >
                      {area.icon}
                    </div>
                    <div>
                      <h3 className="font-grotesk text-lg font-bold text-white">{area.title}</h3>
                      <div
                        className="mt-1.5! h-0.5 w-8 rounded-full"
                        style={{ background: area.color }}
                      />
                    </div>
                  </div>
                  <span className="font-mono text-xs text-white/25">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>

                <p className="mb-5! text-sm leading-relaxed text-[#8fa1b8]">{area.description}</p>

                <div className="flex flex-wrap gap-1.5">
                  {area.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-md px-2.5! py-1! font-mono text-xs"
                      style={{
                        color: area.color,
                        background: `${area.color}12`,
                        border: `1px solid ${area.color}26`,
                      }}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </SpotlightCard>
            </AnimatedSection>
          ))}
        </div>

        {/* ============ OWASP COVERAGE ============ */}
        {total > 0 ? (
        <AnimatedSection delay={100}>
          <div className="rounded-2xl border border-white/10 bg-[#0e1528] p-6! sm:p-8!">
            <div className="mb-6! flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="mb-2! flex items-center gap-3">
                  <ShieldCheck size={22} className="text-[#ef4444]" />
                  <h3 className="font-grotesk text-xl font-bold text-white sm:text-2xl">
                    OWASP Top 10 coverage
                  </h3>
                </div>
                <p className="text-sm text-[#8fa1b8]">
                  Categories actively tested and remediated in application security assessments.
                </p>
              </div>

              <div className="w-full sm:w-64">
                <div className="mb-2! flex items-baseline justify-between font-mono text-xs">
                  <span className="text-[#8fa1b8]">Actively assessed</span>
                  <span className="text-white">
                    {covered}/{total}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: "linear-gradient(90deg, #ef4444, #f97316)",
                    }}
                  />
                </div>
              </div>
            </div>

            <div
              className="grid gap-2.5"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))" }}
            >
              {owasp.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 rounded-xl border px-4! py-3! transition-colors duration-200 ${
                    item.covered
                      ? "border-[#ef4444]/20 bg-[#ef4444]/5 hover:border-[#ef4444]/40"
                      : "border-dashed border-white/10 bg-white/2 hover:border-white/20"
                  }`}
                >
                  {item.covered ? (
                    <CheckCircle2 size={16} className="shrink-0 text-[#34d399]" />
                  ) : (
                    <CircleDashed size={16} className="shrink-0 text-[#6b7fa3]" />
                  )}
                  <span className="shrink-0 font-mono text-xs text-[#ef4444]">{item.id}</span>
                  <span
                    className={`text-sm ${item.covered ? "text-[#c3d0e0]" : "text-[#7c8fa6]"}`}
                  >
                    {item.name}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6! flex flex-wrap gap-5 border-t border-white/6 pt-5!">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-[#34d399]" />
                <span className="font-mono text-xs text-[#8fa1b8]">Actively assessed</span>
              </div>
              <div className="flex items-center gap-2">
                <CircleDashed size={14} className="text-[#6b7fa3]" />
                <span className="font-mono text-xs text-[#8fa1b8]">In progress</span>
              </div>
              <div className="flex items-center gap-2 sm:ml-auto">
                <AlertTriangle size={14} className="text-[#fbbf24]" />
                <span className="font-mono text-xs text-[#8fa1b8]">Based on OWASP Top 10 2021</span>
              </div>
            </div>
          </div>
        </AnimatedSection>
        ) : null}
      </div>
    </section>
  );
}
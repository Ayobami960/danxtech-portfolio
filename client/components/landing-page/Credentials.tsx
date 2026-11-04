"use client";

import type { ReactNode } from "react";
import { Award, GraduationCap } from "lucide-react";
import AnimatedSection from "@/components/ui/AnimatedSection";
import SectionHeader from "@/components/ui/SectionHeader";
import SpotlightCard from "@/components/ui/SpotlightCard";
import type { CredentialItem } from "@/lib/api";

const GOLD = "#f0a500";

/**
 * Group label that separates the two credential families without introducing a
 * second heading level: the section already owns the h2 from SectionHeader.
 */
const GroupLabel = ({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) => (
  <div className="mb-4! flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[#7c8fa6]">
    <span aria-hidden className="text-[#f0a500]">
      {icon}
    </span>
    {children}
  </div>
);

const Period = ({ period }: { period: string | null }) => {
  if (!period) return null;
  return (
    <span
      className="inline-flex w-fit items-center rounded-full px-3! py-1! font-mono text-[11px]"
      style={{
        color: GOLD,
        background: `${GOLD}14`,
        border: `1px solid ${GOLD}30`,
      }}
    >
      {period}
    </span>
  );
};

/**
 * Education and certifications, presented as their own section. Data comes
 * from the same public content read as the rest of the page; nothing renders
 * when neither kind has been published.
 */
export default function Credentials({
  credentials,
}: {
  credentials: CredentialItem[];
}) {
  const degree = credentials.find((item) => item.kind === "degree") ?? null;
  const certifications = credentials.filter(
    (item) => item.kind === "certification",
  );

  if (!degree && certifications.length === 0) return null;

  const hasBoth = Boolean(degree) && certifications.length > 0;

  return (
    <section id="credentials" className="relative overflow-hidden bg-[#0e1528] py-28!">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-0 h-150 w-150 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(240,165,0,.08), transparent 65%)",
          filter: "blur(90px)",
        }}
      />

      <div className="relative px-6! lg:px-16!">
        <SectionHeader
          index="03"
          tag="Credentials"
          title={
            <>
              Education &amp; <span className="gradient-text">certifications</span>
            </>
          }
          description="The academic foundation and professional certifications behind the work."
        />

        <div className={`grid gap-8 ${hasBoth ? "lg:grid-cols-12" : ""}`}>
          {/* ============ ACADEMIC QUALIFICATION ============ */}
          {degree ? (
            <AnimatedSection
              direction="left"
              delay={100}
              className={hasBoth ? "lg:col-span-5" : "max-w-2xl"}
            >
              <GroupLabel icon={<GraduationCap size={13} />}>
                Academic qualification
              </GroupLabel>

              <SpotlightCard
                glow={`${GOLD}22`}
                className="rounded-2xl border bg-[#131c35]/70 p-6! backdrop-blur transition-all duration-300 hover:-translate-y-0.5 sm:p-7!"
                style={{ borderColor: `${GOLD}2e` }}
              >
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-px"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
                  }}
                />

                <div className="flex items-start gap-4">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: `${GOLD}18`,
                      border: `1px solid ${GOLD}33`,
                      color: GOLD,
                    }}
                  >
                    <GraduationCap size={22} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-grotesk text-xl font-bold leading-snug text-white sm:text-2xl">
                      {degree.title}
                    </h3>
                    <div className="mt-1.5! font-mono text-sm" style={{ color: GOLD }}>
                      {degree.issuer}
                    </div>
                  </div>
                </div>

                {degree.period ? (
                  <div className="mt-6! border-t border-white/8 pt-4!">
                    <Period period={degree.period} />
                  </div>
                ) : null}
              </SpotlightCard>
            </AnimatedSection>
          ) : null}

          {/* ============ PROFESSIONAL CERTIFICATIONS ============ */}
          {certifications.length > 0 ? (
            <AnimatedSection
              direction="right"
              delay={160}
              className={hasBoth ? "lg:col-span-7" : ""}
            >
              <GroupLabel icon={<Award size={13} />}>
                Professional certifications
              </GroupLabel>

              <ul
                className={`grid gap-3 ${
                  hasBoth ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"
                }`}
              >
                {certifications.map((certification) => (
                  <li key={certification.id}>
                    <SpotlightCard
                      glow={`${GOLD}18`}
                      className="h-full rounded-2xl border bg-[#131c35]/70 p-5! backdrop-blur transition-all duration-300 hover:-translate-y-0.5"
                      style={{ borderColor: `${GOLD}26` }}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          aria-hidden
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                          style={{
                            background: `${GOLD}14`,
                            border: `1px solid ${GOLD}2e`,
                            color: GOLD,
                          }}
                        >
                          <Award size={18} />
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-grotesk font-semibold leading-snug text-white">
                            {certification.title}
                          </h3>
                          <p className="mt-1! text-xs leading-relaxed text-[#8fa1b8]">
                            {certification.issuer}
                          </p>
                          {certification.period ? (
                            <div className="mt-3!">
                              <Period period={certification.period} />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </SpotlightCard>
                  </li>
                ))}
              </ul>
            </AnimatedSection>
          ) : null}
        </div>
      </div>
    </section>
  );
}

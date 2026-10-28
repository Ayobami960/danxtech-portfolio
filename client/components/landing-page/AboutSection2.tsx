"use client";

import { GraduationCap, Award } from "lucide-react";
import Animated from "../ui/AnimatedSection";
import SectionHeader from "../ui/SectionHeader";
import SpotlightCard from "../ui/SpotlightCard";
import type { About, CredentialItem } from "../../lib/api";

export default function AboutSection({
  about,
  credentials,
}: {
  about: About;
  credentials: CredentialItem[];
}) {
  const credentialCards = credentials.map((credential) => ({
    icon: credential.kind === "degree" ? GraduationCap : Award,
    label: credential.kind === "degree" ? "Education" : "Certified",
    title: credential.title,
    meta: [credential.issuer, credential.period].filter(Boolean).join(" · "),
  }));

  return (
    <section id="about" className="relative overflow-hidden bg-[#0e1528] py-28!">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-0 h-150 w-150 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(59,130,246,.10), transparent 65%)",
          filter: "blur(80px)",
        }}
      />

      <div className="relative px-6! lg:px-16!">
        <SectionHeader
          index="02"
          tag="About"
          title={
            <>
              Building software that <span className="gradient-text">actually scales</span>
            </>
          }
        />

        <div className="grid items-start gap-8 lg:grid-cols-12">
          {/* ============ LEFT — README window ============ */}
          <div className="lg:col-span-7">
            <Animated direction="left" delay={100}>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a1024]/80 backdrop-blur">
                <div className="flex items-center gap-1.5 border-b border-white/5 bg-[#131c35] px-4! py-3!">
                  <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                  <span className="h-3 w-3 rounded-full bg-[#ffbe2e]" />
                  <span className="h-3 w-3 rounded-full bg-[#28c941]" />
                  <span className="ml-3 font-mono text-xs text-[#7c8fa6]">about.md</span>
                </div>

                <div className="space-y-5! p-6! sm:p-8!">
                  {about.paragraphs.map((paragraph, index) => (
                    <p
                      key={index}
                      className={
                        index === 0
                          ? "md:text-lg leading-relaxed text-[#c3d0e0]"
                          : "leading-relaxed text-[#8fa1b8]"
                      }
                    >
                      {paragraph}
                    </p>
                  ))}

                  <div className="flex flex-wrap gap-2 pt-2!">
                    {about.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-white/10 bg-white/3 px-3.5! py-1.5! font-mono text-xs text-[#9db0c6] transition-colors hover:border-[#3b82f6]/50 hover:text-white"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* metrics strip */}
                {about.metrics.length > 0 ? (
                <div className="grid grid-cols-3 divide-x divide-white/5 border-t border-white/5">
                  {about.metrics.map((m) => (
                    <div key={m.label} className="px-4! py-6! text-center sm:px-6!">
                      <div className="font-grotesk text-3xl font-bold text-white sm:text-4xl">
                        {m.value}
                      </div>
                      <div className="mt-1.5! font-mono text-[11px] text-[#7c8fa6]">{m.label}</div>
                    </div>
                  ))}
                </div>
                ) : null}
              </div>
            </Animated>
          </div>

          {/* ============ RIGHT — principles ============ */}
          <div className="lg:col-span-5">
            <Animated direction="right" delay={200}>
              <div className="grid gap-4 sm:grid-cols-2">
                {about.principles.map((c, i) => (
                  <SpotlightCard
                    key={c.title}
                    className="rounded-2xl border border-white/8 bg-white/3 p-5! transition-all duration-300 hover:-translate-y-1 hover:border-[#3b82f6]/30"
                  >
                    <div className="mb-4! flex items-center justify-between">
                      <span className="text-2xl">{c.icon}</span>
                      <span className="font-mono text-[11px] text-white/25">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h4 className="font-grotesk mb-2! font-semibold text-white">{c.title}</h4>
                    <p className="text-sm leading-relaxed text-[#8fa1b8]">{c.body}</p>
                  </SpotlightCard>
                ))}
              </div>
            </Animated>
          </div>
        </div>

        {/* ============ CREDENTIALS ============ */}
        {credentialCards.length > 0 ? (
        <Animated delay={250}>
          <div className="mt-8! grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            {credentialCards.map(({ icon: Icon, label, title, meta }) => (
              <div
                key={title}
                className="flex items-center gap-4 rounded-2xl border border-white/8 bg-white/3 p-5! transition-colors duration-300 hover:border-white/20"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#3b82f6]/25 bg-[#3b82f6]/10 text-[#3b82f6]">
                  <Icon size={19} />
                </div>
                <div className="min-w-0">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#7c8fa6]">
                    {label}
                  </div>
                  <div className="font-grotesk font-semibold text-white">{title}</div>
                  <div className="truncate text-xs text-[#8fa1b8]">{meta}</div>
                </div>
              </div>
            ))}
          </div>
        </Animated>
        ) : null}
      </div>
    </section>
  );
}
"use client";

import { ArrowUp, ArrowUpRight } from "lucide-react";
import type { HeroSocial, Settings } from "../../lib/api";
import { toSocialLinks } from "../../lib/social-links";

const NAV = [
  { label: "About", href: "#about" },
  { label: "Skills", href: "#skills" },
  { label: "Projects", href: "#projects" },
  { label: "Security", href: "#security" },
  { label: "Contact", href: "#contact" },
];

export default function Footer({
  settings,
  socials: heroSocials,
}: {
  settings: Settings | null;
  socials: HeroSocial[];
}) {
  const year = new Date().getFullYear();
  const socials = toSocialLinks(heroSocials, settings?.contactEmail ?? "");

  return (
    <footer className="relative overflow-hidden border-t border-white/5 bg-[#0a0f1e]">
      {/* oversized watermark */}
      <span
        aria-hidden
        className="font-grotesk pointer-events-none absolute -bottom-[6vw] left-1/2 -translate-x-1/2 select-none font-bold leading-none text-white/2.5"
        style={{ fontSize: "28vw" }}
      >
        DK
      </span>

      <div className="relative px-6! lg:px-16!">
        {/* ============ CTA band ============ */}
        <div className="flex flex-col gap-8 border-b border-white/8 py-16! md:flex-row md:items-end md:justify-between">
          <h2
            className="font-grotesk max-w-3xl font-bold leading-[1.05] tracking-tight text-white"
            style={{ fontSize: "clamp(2rem, 5vw, 4rem)" }}
          >
            Let&apos;s build something that{" "}
            <span className="gradient-text">actually scales.</span>
          </h2>

          <a
            href="#contact"
            className="font-grotesk group inline-flex w-fit items-center gap-3 rounded-full bg-white py-2! pl-6! pr-2! font-semibold text-[#0a0f1e] transition-shadow duration-200 hover:shadow-xl hover:shadow-blue-400/20"
          >
            Get in touch
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3b82f6] text-white transition-transform duration-300 group-hover:rotate-45">
              <ArrowUpRight size={18} />
            </span>
          </a>
        </div>

        {/* ============ columns ============ */}
        <div className="grid gap-10 py-12! sm:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="font-grotesk text-2xl font-bold text-white">
              DK<span className="text-[#f0a500]">.</span>
            </div>
            <p className="mt-3! max-w-sm text-sm leading-relaxed text-[#8fa1b8]">
              Full-stack engineer building scalable systems, AI-powered products and secure
              applications from Nigeria.
            </p>
          </div>

          <nav aria-label="Footer" className="lg:col-span-3 lg:col-start-7">
            <div className="mb-4! font-mono text-[11px] uppercase tracking-[0.2em] text-[#7c8fa6]">
              Navigate
            </div>
            <ul className="flex flex-col gap-2.5">
              {NAV.map((n) => (
                <li key={n.href}>
                  <a
                    href={n.href}
                    className="text-sm text-[#9db0c6] transition-colors hover:text-white"
                  >
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="lg:col-span-3">
            <div className="mb-4! font-mono text-[11px] uppercase tracking-[0.2em] text-[#7c8fa6]">
              Connect
            </div>
            <div className="flex gap-3">
              {socials.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-[#7c8fa6] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#3b82f6]/50 hover:text-[#3b82f6]"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* ============ bottom bar ============ */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/8 py-6! sm:flex-row">
          <p className="font-mono text-xs text-[#7c8fa6]">
            © {year} Adetoye Daniel Kehinde. All rights reserved.
          </p>
          <a
            href="#hero"
            className="group inline-flex items-center gap-2 font-mono text-xs text-[#7c8fa6] transition-colors hover:text-[#3b82f6]"
          >
            Back to top
            <ArrowUp
              size={14}
              className="transition-transform duration-200 group-hover:-translate-y-0.5"
            />
          </a>
        </div>
      </div>
    </footer>
  );
}
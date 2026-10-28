"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { NAV_LINKS } from "../../lib/data";
import type { HeroSocial, Settings } from "../../lib/api";
import { toSocialLinks } from "../../lib/social-links";

export default function Navbar({
  settings,
  socials: heroSocials,
}: {
  settings: Settings | null;
  socials: HeroSocial[];
}) {
  const socials = toSocialLinks(heroSocials, settings?.contactEmail ?? "");
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("");
  const [ind, setInd] = useState({ left: 0, width: 0, show: false });

  const barRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  /* Contact is the CTA button on desktop, so keep it out of the pill */
  const links = NAV_LINKS.filter((l) => l.href !== "#contact");
  const mobileLinks = NAV_LINKS.some((l) => l.href === "#contact")
    ? NAV_LINKS
    : [...NAV_LINKS, { href: "#contact", label: "Hire Me" }];

  /* ---------- scroll: state, progress bar, hide on scroll down ---------- */
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let last = window.scrollY;
    let ticking = false;

    const update = () => {
      const y = window.scrollY;
      setScrolled(y > 40);
      if (y < 200) setActive("");

      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`;
      }

      if (!reduce) {
        if (y > last + 6 && y > 240) setHidden(true);
        else if (y < last - 6 || y <= 240) setHidden(false);
      }
      last = y;
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ---------- active section (whichever crosses the middle of the screen) ---------- */
  useEffect(() => {
    const sections = document.querySelectorAll<HTMLElement>("section[id]");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && window.scrollY >= 200) setActive(e.target.id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  /* ---------- sliding indicator ---------- */
  useEffect(() => {
    const measure = () => {
      const el = linkRefs.current[active];
      if (!el) return setInd((i) => ({ ...i, show: false }));
      setInd({ left: el.offsetLeft, width: el.offsetWidth, show: true });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (listRef.current) ro.observe(listRef.current);
    return () => ro.disconnect();
  }, [active]);

  /* ---------- mobile menu: lock scroll, Esc, close on desktop resize ---------- */
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onResize = () => window.innerWidth >= 768 && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const hide = hidden && !open;

  return (
    <>
      {/* scroll progress */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-60 h-0.5">
        <div
          ref={barRef}
          className="h-full origin-left bg-linear-to-r from-[#3b82f6] via-[#8b5cf6] to-[#f0a500] will-change-transform"
          style={{ transform: "scaleX(0)" }}
        />
      </div>

      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-out ${
          scrolled ? "pt-3!" : "pt-0!"
        } ${hide ? "-translate-y-full" : "translate-y-0"}`}
        onFocusCapture={() => setHidden(false)}
      >
        <nav
          aria-label="Primary"
          className={`mx-auto grid w-full items-center transition-all duration-500 ease-out md:grid-cols-[1fr_auto_1fr] ${
            scrolled
              ? "max-w-5xl rounded-full border border-white/10 bg-[#0a0f1e]/70 px-4! py-2.5! shadow-2xl shadow-black/40 backdrop-blur-xl"
              : "max-w-full rounded-none border border-transparent bg-transparent px-6! py-5! lg:px-16!"
          }`}
        >
          {/* ---------- logo ---------- */}
          <div className="flex items-center justify-between md:justify-self-start">
            <a
              href="#hero"
              aria-label="Back to top"
              className="font-grotesk group flex items-center gap-2 text-xl font-bold text-white"
            >
              <span className="transition-transform duration-300 group-hover:-rotate-6">
                DK<span className="text-[#f0a500]">.</span>
              </span>
              <span className="hidden items-center gap-1.5 rounded-full border border-[#10b981]/25 bg-[#10b981]/10 px-2.5! py-0.5! font-mono text-[10px] font-normal text-[#10b981] xl:inline-flex">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#10b981]"
                  style={{ animation: "dotPulse 2s ease-in-out infinite" }}
                />
                Open to work
              </span>
            </a>

            {/* burger */}
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="mobile-menu"
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/4 md:hidden"
            >
              <span
                className={`absolute h-0.5 w-4.5 rounded-full bg-white transition-all duration-300 ${
                  open ? "translate-y-0 rotate-45" : "-translate-y-1.25"
                }`}
              />
              <span
                className={`absolute h-0.5 w-4.5 rounded-full bg-white transition-all duration-300 ${
                  open ? "translate-y-0 -rotate-45" : "translate-y-1.25"
                }`}
              />
            </button>
          </div>

          {/* ---------- desktop links ---------- */}
          <ul
            ref={listRef}
            className="relative hidden items-center rounded-full border border-white/8 bg-white/3 p-1! md:flex"
          >
            <span
              aria-hidden
              className="absolute bottom-1 top-1 rounded-full bg-white/10 transition-all duration-300 ease-out"
              style={{ left: ind.left, width: ind.width, opacity: ind.show ? 1 : 0 }}
            />
            {links.map((l) => {
              const id = l.href.slice(1);
              const isActive = active === id;
              return (
                <li key={l.href}>
                  <a
                    ref={(el) => {
                      linkRefs.current[id] = el;
                    }}
                    href={l.href}
                    aria-current={isActive ? "location" : undefined}
                    className={`relative z-10 block rounded-full px-4! py-1.5! text-sm transition-colors duration-200 ${
                      isActive ? "text-white" : "text-[#8fa1b8] hover:text-white"
                    }`}
                  >
                    {l.label}
                  </a>
                </li>
              );
            })}
          </ul>

          {/* ---------- CTA ---------- */}
          <div className="hidden md:block md:justify-self-end">
            <a
              href="#contact"
              className="font-grotesk group inline-flex items-center gap-2.5 rounded-full bg-white py-1.5! pl-5! pr-1.5! text-sm font-semibold text-[#0a0f1e] transition-shadow duration-200 hover:shadow-lg hover:shadow-blue-400/25"
            >
              Hire Me
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3b82f6] text-white transition-transform duration-300 group-hover:rotate-45">
                <ArrowUpRight size={16} />
              </span>
            </a>
          </div>
        </nav>
      </header>

      {/* ================= mobile overlay ================= */}
      <div
        id="mobile-menu"
        className={`fixed inset-0 z-40 flex flex-col bg-[#0a0f1e]/95 px-6! pb-8! pt-28! backdrop-blur-2xl transition-[opacity,visibility] duration-300 md:hidden ${
          open ? "visible opacity-100" : "invisible opacity-0"
        }`}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 top-20 h-96 w-96 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(59,130,246,.18), transparent 65%)",
            filter: "blur(60px)",
          }}
        />

        <ul className="relative flex flex-1 flex-col justify-center gap-1">
          {mobileLinks.map((l, i) => {
            const isActive = active === l.href.slice(1);
            return (
              <li
                key={l.href}
                className={`transition-all duration-500 ${
                  open ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
                }`}
                style={{ transitionDelay: open ? `${100 + i * 60}ms` : "0ms" }}
              >
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="group flex items-baseline gap-4 border-b border-white/6 py-4!"
                >
                  <span className="font-mono text-xs text-[#3b82f6]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={`font-grotesk text-4xl font-bold tracking-tight transition-colors ${
                      isActive ? "text-white" : "text-[#8fa1b8] group-hover:text-white"
                    }`}
                  >
                    {l.label}
                  </span>
                  {isActive && <span className="ml-auto h-2 w-2 rounded-full bg-[#3b82f6]" />}
                </a>
              </li>
            );
          })}
        </ul>

        <div
          className={`relative flex items-center justify-between transition-all duration-500 ${
            open ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
          style={{ transitionDelay: open ? `${120 + mobileLinks.length * 60}ms` : "0ms" }}
        >
          <div className="flex gap-3">
            {socials.map(({ icon: Icon, href, label }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-[#8fa1b8] transition-colors hover:border-[#3b82f6]/50 hover:text-[#3b82f6]"
              >
                <Icon size={17} />
              </a>
            ))}
          </div>
          <span className="font-mono text-xs text-[#7c8fa6]">Nigeria 🇳🇬</span>
        </div>
      </div>
    </>
  );
}
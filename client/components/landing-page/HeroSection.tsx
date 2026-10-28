"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type SubmitEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useSyncExternalStore,
} from "react";
import {
  ArrowUpRight,
  ArrowDown,
  Download,
  Clock,
  CornerDownLeft,
  Mail,
} from "lucide-react";
import { FaGithub, FaLinkedinIn, FaTwitter } from "react-icons/fa6";

import type { About, Hero, HeroSocialPlatform, ResumeMetadata, SkillGroup } from "../../lib/api";
import { resumeDownloadUrl } from "../../lib/api";
import { formatBytes } from "../../lib/format";

/* ================================================================== */
/* Config                                                              */
/* ================================================================== */
const SOCIAL_ICONS: Record<
  HeroSocialPlatform,
  ComponentType<{ size?: number | string; className?: string }>
> = {
  github: FaGithub,
  linkedin: FaLinkedinIn,
  twitter: FaTwitter,
  email: Mail,
};

const SOCIAL_LABELS: Record<HeroSocialPlatform, string> = {
  github: "GitHub",
  linkedin: "LinkedIn",
  twitter: "Twitter",
  email: "Email",
};


type Accent = { name: string; hex: string; rgb: string };
const ACCENTS: Accent[] = [
  { name: "blue", hex: "#3b82f6", rgb: "59,130,246" },
  { name: "emerald", hex: "#10b981", rgb: "16,185,129" },
  { name: "amber", hex: "#f0a500", rgb: "240,165,0" },
  { name: "violet", hex: "#8b5cf6", rgb: "139,92,246" },
  { name: "rose", hex: "#f43f5e", rgb: "244,63,94" },
];

const QUICK_COMMANDS = ["help", "neofetch", "skills", "theme", "contact"];

const ASCII_DK = [
  "██████╗ ██╗  ██╗",
  "██╔══██╗██║ ██╔╝",
  "██║  ██║█████╔╝ ",
  "██║  ██║██╔═██╗ ",
  "██████╔╝██║  ██╗",
  "╚═════╝ ╚═╝  ╚═╝",
];

const BOOT_LINES = [
  "Initialising portfolio kernel",
  "Loading modules: react · next · node · python",
  "Mounting AI integration layer",
  "Running test suite · 90%+ coverage",
];

/* ================================================================== */
/* Hooks                                                               */
/* ================================================================== */
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

function useTypewriter(phrases: string[], reduced: boolean) {
  const [text, setText] = useState("");
  const [index, setIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const phrase = phrases[index];
    const doneTyping = !deleting && text === phrase;
    const doneDeleting = deleting && text === "";
    const delay = doneTyping ? 1800 : doneDeleting ? 350 : deleting ? 40 : 75;

    const t = setTimeout(() => {
      if (doneTyping) setDeleting(true);
      else if (doneDeleting) {
        setDeleting(false);
        setIndex((i) => (i + 1) % phrases.length);
      } else {
        setText(
          deleting ? phrase.slice(0, text.length - 1) : phrase.slice(0, text.length + 1)
        );
      }
    }, delay);
    return () => clearTimeout(t);
  }, [text, deleting, index, phrases, reduced]);

  return reduced ? (phrases[0] ?? "") : text;
}

function useLagosClock() {
  const [time, setTime] = useState("--:--");
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Lagos",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const tick = () => setTime(fmt.format(new Date()));
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, []);
  return time;
}

const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Decrypt-style reveal. `trigger` changes → replay. */
function useScramble(text: string, trigger: number, reduced: boolean, startDelay: number) {
  const [out, setOut] = useState(text);

  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const duration = 900;

    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / duration, 1);
        const resolved = Math.floor(p * text.length);
        setOut(
          text
            .split("")
            .map((ch, i) =>
              i < resolved || ch === " "
                ? ch
                : SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]
            )
            .join("")
        );
        if (p < 1) raf = requestAnimationFrame(tick);
        else setOut(text);
      };
      raf = requestAnimationFrame(tick);
    };

    const timeout = setTimeout(run, trigger === 0 ? startDelay : 0);
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(raf);
    };
  }, [text, trigger, reduced, startDelay]);

  return reduced ? text : out;
}

function ScrambleWord({
  text,
  delay,
  reduced,
  className = "",
}: {
  text: string;
  delay: number;
  reduced: boolean;
  className?: string;
}) {
  const [trigger, setTrigger] = useState(0);
  const out = useScramble(text, trigger, reduced, delay);
  return (
    <span
      aria-hidden
      className={className}
      onMouseEnter={() => setTrigger((t) => t + 1)}
    >
      {out}
    </span>
  );
}

/* ================================================================== */
/* Particle network background (canvas, no dependencies)               */
/* ================================================================== */
function ParticleField({ rgb, reduced }: { rgb: string; reduced: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rgbRef = useRef(rgb);
  useEffect(() => {
    rgbRef.current = rgb;
  }, [rgb]);

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    type Node = { x: number; y: number; vx: number; vy: number; r: number };
    let w = 0;
    let h = 0;
    let raf = 0;
    let visible = true;
    let nodes: Node[] = [];
    const mouse = { x: -9999, y: -9999 };

    const init = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(90, Math.floor((w * h) / 16000));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.4 + 0.6,
      }));
    };

    const onMove = (e: globalThis.MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visible || document.hidden) return;
      ctx.clearRect(0, 0, w, h);
      const c = rgbRef.current;

      for (const n of nodes) {
        const dx = mouse.x - n.x;
        const dy = mouse.y - n.y;
        const d = Math.hypot(dx, dy);
        if (d < 160 && d > 0) {
          n.x += (dx / d) * 0.25;
          n.y += (dy / d) * 0.25;
        }
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c},0.75)`;
        ctx.fill();
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
          if (d < 120) {
            ctx.strokeStyle = `rgba(${c},${(1 - d / 120) * 0.22})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
        const md = Math.hypot(nodes[i].x - mouse.x, nodes[i].y - mouse.y);
        if (md < 170) {
          ctx.strokeStyle = `rgba(${c},${(1 - md / 170) * 0.5})`;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }
    };

    init();
    const ro = new ResizeObserver(init);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    io.observe(canvas);
    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [reduced]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 h-full w-full opacity-70"
    />
  );
}

/* ================================================================== */
/* Magnetic wrapper                                                    */
/* ================================================================== */
function Magnetic({ children, reduced }: { children: ReactNode; reduced: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const onMove = (e: MouseEvent<HTMLSpanElement>) => {
    const el = ref.current;
    if (!el || reduced) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2);
    const y = e.clientY - (r.top + r.height / 2);
    el.style.transform = `translate(${x * 0.25}px, ${y * 0.3}px)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = "translate(0,0)";
  };
  return (
    <span
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="inline-block transition-transform duration-200 ease-out"
    >
      {children}
    </span>
  );
}

/* ================================================================== */
/* Terminal commands                                                   */
/* ================================================================== */
type Entry = { id: number; cmd?: string; out: ReactNode };
type Command = { desc: string; hidden?: boolean; run: (args: string[]) => ReactNode };

const Dim = ({ children }: { children: ReactNode }) => <span className="text-[#7c8fa6]">{children}</span>;
const Hl = ({ children }: { children: ReactNode }) => <span className="text-[#f0a500]">{children}</span>;
const Ok = ({ children }: { children: ReactNode }) => <span className="text-[#10b981]">{children}</span>;
const Acc = ({ children }: { children: ReactNode }) => (
  <span className="text-[color:var(--accent)]">{children}</span>
);

const FILES: Record<string, string> = {
  "about.md": "about",
  "skills.json": "skills",
  "impact.log": "impact",
};

function scrollToSection(sel: string) {
  document.querySelector(sel)?.scrollIntoView({ behavior: "smooth" });
}

function makeCommands(ctx: {
  accentName: string;
  onAccent: (name: string) => void;
  aboutText: string;
  skillGroups: SkillGroup[];
  stats: Hero["stats"];
  location: string;
}): Record<string, Command> {
  const cmds: Record<string, Command> = {
    help: {
      desc: "list available commands",
      run: () => (
        <div className="flex flex-col gap-1">
          {Object.entries(cmds)
            .filter(([, c]) => !c.hidden)
            .map(([name, c]) => (
              <div key={name} className="flex gap-3">
                <span className="w-24 shrink-0 text-(--accent)">{name}</span>
                <Dim>{c.desc}</Dim>
              </div>
            ))}
          <div className="flex gap-3">
            <span className="w-24 shrink-0 text-(--accent)">clear</span>
            <Dim>clear the terminal (or Ctrl+L)</Dim>
          </div>
          <div className="mt-1!"><Dim>Tip: Tab autocompletes, ↑ ↓ browse history.</Dim></div>
        </div>
      ),
    },
    about: {
      desc: "who is Daniel?",
      run: () => (
        <p className="max-w-md whitespace-pre-line leading-relaxed text-[#c3d0e0]">
          {ctx.aboutText || "Daniel Kehinde is a full-stack engineer from Nigeria."}
        </p>
      ),
    },
    whoami: {
      desc: "short version",
      run: () => <span className="text-[#c3d0e0]">daniel — full-stack engineer, open to work</span>,
    },
    neofetch: {
      desc: "system info, portfolio edition",
      run: () => (
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
          <pre aria-hidden className="hidden text-[11px] leading-tight text-[color:var(--accent)] sm:block">
            {ASCII_DK.join("\n")}
          </pre>
          <div className="flex flex-col gap-0.5">
            <div>
              <Acc>daniel</Acc>
              <Dim>@</Dim>
              <Acc>portfolio</Acc>
            </div>
            <Dim>─────────────────</Dim>
            <div><Acc>Role    </Acc> Software Engineer</div>
            <div><Acc>Stack   </Acc> React · Next.js · Node · Python</div>
            <div><Acc>Focus   </Acc> Scalable systems · AI</div>
            <div><Acc>Tests   </Acc> 90%+ coverage</div>
            <div><Acc>Perf    </Acc> 45% faster APIs</div>
            <div><Acc>Where   </Acc> {ctx.location || "Nigeria"}</div>
            <div><Acc>Status  </Acc> <Ok>Open to work</Ok></div>
            <div className="mt-2! flex gap-1.5">
              {ACCENTS.map((a) => (
                <span key={a.name} className="h-3 w-5 rounded-xs" style={{ background: a.hex }} />
              ))}
            </div>
          </div>
        </div>
      ),
    },
    skills: {
      desc: "languages, frameworks, focus areas",
      run: () => (
        <div className="flex flex-col gap-1">
          {ctx.skillGroups.length > 0 ? (
            ctx.skillGroups.map((group) => (
              <div key={group.title}>
                <Dim>{group.title.toLowerCase().padEnd(10, " ")}</Dim>{" "}
                {group.items.join(", ")}
              </div>
            ))
          ) : (
            <Dim>No skills added yet.</Dim>
          )}
        </div>
      ),
    },
    impact: {
      desc: "results that matter",
      run: () => (
        <div className="flex flex-col gap-1">
          {ctx.stats.length > 0 ? (
            ctx.stats.map((stat) => (
              <div key={`${stat.value}-${stat.label}`}>
                <Ok>✓</Ok> <Hl>{stat.value}</Hl> {stat.label}
              </div>
            ))
          ) : (
            <Dim>No stats added yet.</Dim>
          )}
        </div>
      ),
    },
    ls: {
      desc: "list files",
      run: () => (
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {Object.keys(FILES).map((f) => (
            <span key={f} className="text-sky-300">{f}</span>
          ))}
          <span className="text-[color:var(--accent)]">projects/</span>
          <span className="text-[#10b981]">contact.sh</span>
        </div>
      ),
    },
    cat: {
      desc: "read a file, e.g. cat about.md",
      run: (args) => {
        const key = FILES[args[0] ?? ""];
        if (key) return cmds[key].run([]);
        if (!args[0]) return <span className="text-[#ff6b6b]">cat: missing file. Try <Hl>ls</Hl>.</span>;
        return <span className="text-[#ff6b6b]">cat: {args[0]}: No such file</span>;
      },
    },
    theme: {
      desc: "recolour the whole page, e.g. theme violet",
      run: (args) => {
        if (!args[0]) {
          return (
            <div className="flex flex-col gap-1">
              {ACCENTS.map((a) => (
                <div key={a.name} className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ background: a.hex }} />
                  <span className="w-20">{a.name}</span>
                  {a.name === ctx.accentName && <Dim>(current)</Dim>}
                </div>
              ))}
              <Dim>Usage: theme &lt;name&gt;</Dim>
            </div>
          );
        }
        const found = ACCENTS.find((a) => a.name === args[0]);
        if (!found) {
          return <span className="text-[#ff6b6b]">theme: unknown colour “{args[0]}”. Run <Hl>theme</Hl>.</span>;
        }
        ctx.onAccent(found.name);
        return <span><Ok>✓</Ok> Theme set to <span style={{ color: found.hex }}>{found.name}</span></span>;
      },
    },
    projects: {
      desc: "jump to the projects section",
      run: () => {
        scrollToSection("#projects");
        return <Dim>Scrolling to projects…</Dim>;
      },
    },
    contact: {
      desc: "jump to the contact section",
      run: () => {
        scrollToSection("#contact");
        return <Dim>Opening contact… <Ok>open to work ✓</Ok></Dim>;
      },
    },
    sudo: {
      desc: "",
      hidden: true,
      run: (args) => {
        if (args.join(" ") === "hire me") {
          setTimeout(() => scrollToSection("#contact"), 1200);
          return (
            <div className="flex flex-col gap-1">
              <div><Ok>✓</Ok> Permission granted.</div>
              <div><Ok>✓</Ok> Excellent decision.</div>
              <Dim>Redirecting you to contact…</Dim>
            </div>
          );
        }
        return <span className="text-[#ff6b6b]">sudo: nice try. Only Daniel has root here.</span>;
      },
    },
  };
  return cmds;
}

/* ================================================================== */
/* Terminal                                                            */
/* ================================================================== */
function Terminal({
  accentName,
  onAccent,
  reduced,
  hero,
  about,
  skillGroups,
}: {
  accentName: string;
  onAccent: (name: string) => void;
  reduced: boolean;
  hero: Hero;
  about: About;
  skillGroups: SkillGroup[];
}) {
  const idRef = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const past = useRef<string[]>([]);
  const pos = useRef(-1);

  const [input, setInput] = useState("");
  const [booted, setBooted] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);

  const commands = makeCommands({
    accentName,
    onAccent,
    aboutText: about.paragraphs.join("\n\n"),
    skillGroups,
    stats: hero.stats,
    location: hero.location,
  });
  const commandsRef = useRef(commands);
  useEffect(() => {
    commandsRef.current = commands;
  });

  const push = useCallback((out: ReactNode, cmd?: string) => {
    setEntries((prev) => [...prev, { id: idRef.current++, cmd, out }]);
  }, []);

  /* boot sequence */
  useEffect(() => {
    const lines = [
      ...BOOT_LINES.map((t) => (
        <div key={t}>
          <span className="text-[#10b981]">[ OK ]</span> <span className="text-[#9db0c6]">{t}</span>
        </div>
      )),
      <div key="ready" className="mt-1! text-[#c3d0e0]">
        Ready. Type <Hl>help</Hl> to begin — or try <Hl>sudo hire me</Hl>.
      </div>,
    ];

    if (reduced) {
      setEntries(lines.map((out) => ({ id: idRef.current++, out })));
      setBooted(true);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    lines.forEach((out, i) => {
      timers.push(
        setTimeout(() => {
          setEntries((prev) => [...prev, { id: idRef.current++, out }]);
          if (i === lines.length - 1) setBooted(true);
        }, 500 + i * 420)
      );
    });
    return () => timers.forEach(clearTimeout);
  }, [reduced]);

  /* keep scrolled to bottom */
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);

  /* Ctrl/⌘ + K focuses the terminal */
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        frameRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        inputRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const run = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      const [name, ...args] = trimmed.toLowerCase().split(/\s+/);

      past.current.push(trimmed);
      pos.current = -1;

      if (name === "clear") {
        setEntries([]);
        return;
      }

      const cmd = commandsRef.current[name];
      push(
        cmd ? (
          cmd.run(args)
        ) : (
          <span className="text-[#ff6b6b]">
            command not found: {name}. Try <Hl>help</Hl>.
          </span>
        ),
        trimmed
      );
    },
    [push]
  );

  const onSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    run(input);
    setInput("");
  };

  const autocomplete = () => {
    const parts = input.toLowerCase().split(/\s+/);
    if (parts.length === 1) {
      const names = [...Object.keys(commands).filter((k) => !commands[k].hidden), "clear"];
      const matches = names.filter((n) => n.startsWith(parts[0]));
      if (matches.length === 1) setInput(matches[0] + " ");
      else if (matches.length > 1)
        push(<span className="text-[#9db0c6]">{matches.join("   ")}</span>, input);
    } else if (parts[0] === "theme" && parts.length === 2) {
      const matches = ACCENTS.filter((a) => a.name.startsWith(parts[1]));
      if (matches.length === 1) setInput(`theme ${matches[0].name}`);
    } else if (parts[0] === "cat" && parts.length === 2) {
      const matches = Object.keys(FILES).filter((f) => f.startsWith(parts[1]));
      if (matches.length === 1) setInput(`cat ${matches[0]}`);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const hist = past.current;
    if (e.key === "Tab") {
      e.preventDefault();
      autocomplete();
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setEntries([]);
    } else if (e.key === "ArrowUp" && hist.length) {
      e.preventDefault();
      pos.current = Math.min(pos.current + 1, hist.length - 1);
      setInput(hist[hist.length - 1 - pos.current]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      pos.current = Math.max(pos.current - 1, -1);
      setInput(pos.current === -1 ? "" : hist[hist.length - 1 - pos.current]);
    }
  };

  return (
    <div ref={frameRef} className="relative w-full max-w-3xl">
      <div aria-hidden className="absolute -inset-6 rounded-[2rem] blur-3xl" style={{ background: "rgba(var(--accent-rgb),.12)" }} />

      <div className="tp-border relative rounded-2xl p-px!">
        <div className="overflow-hidden rounded-2xl bg-[#0a1024]/95 backdrop-blur-xl">
          {/* chrome */}
          <div className="flex items-center justify-between border-b border-white/5 bg-[#131c35] px-4! py-3!">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#ffbe2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c941]" />
            </div>
            <span className="font-mono text-xs text-[#7c8fa6]">daniel@portfolio</span>
            <kbd className="hidden rounded border border-white/10 bg-white/4 px-1.5! py-0.5! font-mono text-[10px] text-[#7c8fa6] sm:block">
              Ctrl K
            </kbd>
            <span className="w-3 sm:hidden" aria-hidden />
          </div>

          {/* body */}
          <div
            ref={bodyRef}
            onClick={() => inputRef.current?.focus({ preventScroll: true })}
            className="h-96 cursor-text overflow-y-auto p-5! font-mono text-[14px] leading-7 text-[#e6edf7] sm:h-120 sm:text-[15px]"
            role="log"
            aria-live="polite"
          >
            {entries.map((en) => (
              <div key={en.id} className="tp-line mb-3!">
                {en.cmd !== undefined && (
                  <div>
                    <span className="text-[#f0a500]">~/portfolio $</span>{" "}
                    <span className="text-white">{en.cmd}</span>
                  </div>
                )}
                <div>{en.out}</div>
              </div>
            ))}

            <form onSubmit={onSubmit} className="flex items-center gap-2">
              <span className="shrink-0 text-[#f0a500]">~/portfolio $</span>
              <input
                ref={inputRef}
                value={input}
                disabled={!booted}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                aria-label="Terminal command"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder={booted ? "type a command…" : "booting…"}
                className="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-white/20"
                style={{ caretColor: "var(--accent)" }}
              />
            </form>
          </div>

          {/* quick commands */}
          <div className="flex flex-wrap items-center gap-2 border-t border-white/5 bg-[#131c35] px-4! py-3!">
            <span className="mr-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-[#7c8fa6]">
              try <CornerDownLeft size={11} />
            </span>
            {QUICK_COMMANDS.map((c) => (
              <button
                key={c}
                type="button"
                disabled={!booted}
                onClick={() => run(c)}
                className="rounded-md border border-white/10 bg-white/4 px-2.5! py-1! font-mono text-xs text-[#9db0c6] transition-colors hover:border-[color:var(--accent)] hover:text-white disabled:opacity-40"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Hero                                                                */
/* ================================================================== */
export default function HeroSection({
  hero,
  about,
  skills,
  resume,
}: {
  hero: Hero;
  about: About;
  skills: SkillGroup[];
  resume: ResumeMetadata;
}) {
  const reduced = usePrefersReducedMotion();

  const phrases = hero.typingPhrases.length ? hero.typingPhrases : ["Software engineer"];
  const stats = hero.stats;
  const names = hero.nameParts;
  const availability = hero.availability;
  const intro = hero.intro;
  const socials = hero.socials;
  const location = hero.location;
  const resumeHref = resumeDownloadUrl(
    resume.available ? resume.updatedAt : undefined,
  );

  const text = useTypewriter(phrases, reduced);
  const time = useLagosClock();
  const [accentName, setAccentName] = useState("blue");
  const sectionRef = useRef<HTMLElement>(null);

  const accent = ACCENTS.find((a) => a.name === accentName) ?? ACCENTS[0];

  const onMove = (e: MouseEvent<HTMLElement>) => {
    const el = sectionRef.current;
    if (!el || reduced) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--px", String(((e.clientX - r.left) / r.width - 0.5) * 2));
    el.style.setProperty("--py", String(((e.clientY - r.top) / r.height - 0.5) * 2));
  };

  return (
    <section
      id="hero"
      ref={sectionRef}
      onMouseMove={onMove}
      className="relative flex min-h-screen flex-col overflow-hidden grid-bg"
      style={
        {
          "--accent": accent.hex,
          "--accent-rgb": accent.rgb,
          "--px": 0,
          "--py": 0,
        } as React.CSSProperties
      }
    >
      <style>{`
        @keyframes tp-fade   { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: none; } }
        @keyframes tp-line   { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes tp-border { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
        .tp-fade   { animation: tp-fade .85s cubic-bezier(.2,.7,.2,1) both; }
        .tp-line   { animation: tp-line .3s ease both; }
        .tp-border { background: linear-gradient(120deg, var(--accent), #8b5cf6, #f0a500, #10b981, var(--accent)); background-size: 200% 200%; animation: tp-border 7s linear infinite; }
        .tp-outline {
          display: inline-block;
          color: transparent;
          -webkit-text-stroke: 1.5px rgba(255,255,255,.6);
        }
        .tp-outline:hover {
          background-image: linear-gradient(90deg, var(--accent), #8b5cf6, #f0a500);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          -webkit-text-stroke-color: transparent;
        }
        .tp-link { background-image: linear-gradient(currentColor, currentColor); background-size: 100% 1px; background-repeat: no-repeat; background-position: 0 100%; transition: background-size .3s ease; }
        .tp-link:hover { background-size: 0% 1px; background-position: 100% 100%; }
        @media (prefers-reduced-motion: reduce) {
          .tp-fade, .tp-line, .tp-border { animation: none !important; }
        }
      `}</style>

      {/* ---------------- background ---------------- */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <ParticleField rgb={accent.rgb} reduced={reduced} />

        <div
          className="absolute -left-40 top-1/4 h-175 w-175 rounded-full transition-colors duration-700"
          style={{
            background: "radial-gradient(circle, rgba(var(--accent-rgb),.16), transparent 65%)",
            filter: "blur(70px)",
            transform: "translate3d(calc(var(--px) * 18px), calc(var(--py) * 18px), 0)",
          }}
        />
        <div
          className="absolute -right-32 bottom-0 h-125 w-125 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(139,92,246,.12), transparent 65%)",
            filter: "blur(80px)",
            transform: "translate3d(calc(var(--px) * -24px), calc(var(--py) * -24px), 0)",
          }}
        />
        <span
          className="font-grotesk absolute -bottom-[8vw] right-[-2vw] select-none font-bold leading-none text-white/3"
          style={{
            fontSize: "38vw",
            transform: "translate3d(calc(var(--px) * -30px), calc(var(--py) * -30px), 0)",
          }}
        >
          DK
        </span>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,#0a0f1e_95%)]" />
      </div>

      {/* ---------------- main ---------------- */}
      <div className="relative flex flex-1 items-center px-6! pb-10! pt-32! lg:px-16!">
        <div className="grid w-full items-center gap-14 lg:grid-cols-12 lg:gap-10">
          {/* ============ LEFT ============ */}
          <div className="lg:col-span-6">
            <div
              className="tp-fade mb-8! flex flex-wrap items-center gap-4 font-mono text-xs"
              style={{ animationDelay: "0.05s" }}
            >
              <span className="text-[#7c8fa6]">01 — Portfolio</span>
              <span className="h-px w-10 bg-white/20" />
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3! py-1! ${
                  availability.isAvailable
                    ? "border-[#10b981]/25 bg-[#10b981]/10 text-[#10b981]"
                    : "border-[#f0a500]/25 bg-[#f0a500]/10 text-[#f0a500]"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    availability.isAvailable ? "bg-[#10b981]" : "bg-[#f0a500]"
                  }`}
                  style={{ animation: "dotPulse 2s ease-in-out infinite" }}
                />
                {availability.label}
              </span>
            </div>

            <h1
              aria-label={names.join(" ")}
              className="font-grotesk font-bold uppercase leading-[0.92] tracking-tighter text-white"
              style={{ fontSize: "clamp(3.2rem, 9vw, 7.5rem)" }}
            >
              {names.map((part, index) => (
                <span key={`${part}-${index}`} className="block">
                  <ScrambleWord
                    text={part}
                    delay={150 + index * 200}
                    reduced={reduced}
                    className={index === names.length - 1 ? "tp-outline" : ""}
                  />
                </span>
              ))}
            </h1>

            <div
              className="tp-fade mt-8! flex min-h-7 items-center gap-2 font-mono text-sm sm:text-base"
              style={{ animationDelay: "0.4s" }}
              aria-label="Software engineer"
            >
              <span aria-hidden className="text-[#f0a500]">~/portfolio $</span>
              <span aria-hidden className="text-[color:var(--accent)]">{text}</span>
              <span aria-hidden className="cursor inline-block h-4 w-0.5" style={{ background: "var(--accent)" }} />
            </div>

            <p
              className="tp-fade mt-5! max-w-xl text-base leading-relaxed text-[#8fa1b8] sm:text-lg"
              style={{ animationDelay: "0.48s" }}
            >
              {intro}
            </p>

            <div
              className="tp-fade mt-9! flex flex-wrap items-center gap-x-8 gap-y-4"
              style={{ animationDelay: "0.56s" }}
            >
              <Magnetic reduced={reduced}>
                <a
                  href="#projects"
                  className="font-grotesk group inline-flex items-center gap-3 rounded-full bg-white py-2! pl-6! pr-2! font-semibold text-[#0a0f1e] transition-shadow duration-200 hover:shadow-xl"
                  style={{ boxShadow: "0 10px 30px -10px rgba(var(--accent-rgb),.5)" }}
                >
                  View Projects
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform duration-300 group-hover:rotate-45"
                    style={{ background: "var(--accent)" }}
                  >
                    <ArrowUpRight size={18} />
                  </span>
                </a>
              </Magnetic>
              <a href="#contact" className="tp-link font-grotesk font-semibold text-white">
                Get in touch
              </a>
              {resume.available && (
                <a
                  href={resumeHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Download ${resume.fileName} (${formatBytes(resume.sizeBytes)})`}
                  aria-label={`Download ${resume.fileName} (${formatBytes(resume.sizeBytes)})`}
                  className="font-grotesk inline-flex items-center gap-2 font-semibold text-[#7c8fa6] transition-colors duration-200 hover:text-[#f0a500]"
                >
                  <Download size={16} /> Resume
                  <span className="font-mono text-[11px] font-normal text-white/40">
                    {formatBytes(resume.sizeBytes)}
                  </span>
                </a>
              )}
            </div>

            <dl
              className="tp-fade mt-12! flex flex-wrap items-center gap-x-10 gap-y-6 border-t border-white/10 pt-7!"
              style={{ animationDelay: "0.66s" }}
            >
              {stats.map((s, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <dd className="font-grotesk text-3xl font-bold leading-none text-white">{s.value}</dd>
                  <dt className="font-mono text-xs text-[#7c8fa6]">{s.label}</dt>
                </div>
              ))}
            </dl>
          </div>

          {/* ============ RIGHT ============ */}
          <div
            className="tp-fade flex justify-center lg:col-span-6 lg:justify-end"
            style={{ animationDelay: "0.35s" }}
          >
            <Terminal
              accentName={accentName}
              onAccent={setAccentName}
              reduced={reduced}
              hero={hero}
              about={about}
              skillGroups={skills}
            />
          </div>
        </div>
      </div>

      {/* ---------------- bottom bar ---------------- */}
      <div className="relative flex items-center justify-between gap-4 border-t border-white/10 px-6! py-5! lg:px-16!">
        <div className="flex gap-2">
          {socials.map(({ platform, url }) => {
            const Icon = SOCIAL_ICONS[platform];
            const label = SOCIAL_LABELS[platform];
            return (
              <a
                key={`${platform}-${url}`}
                href={url}
                aria-label={label}
                target={url.startsWith("http") ? "_blank" : undefined}
                rel={url.startsWith("http") ? "noopener noreferrer" : undefined}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-[#7c8fa6] transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
              >
                <Icon size={15} />
              </a>
            );
          })}
        </div>

        <a
          href="#about"
          aria-label="Scroll to next section"
          className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#7c8fa6] transition-colors hover:text-[color:var(--accent)] md:flex"
        >
          scroll
          <ArrowDown
            size={14}
            style={{ animation: reduced ? undefined : "orbFloat 2s ease-in-out infinite" }}
          />
        </a>

        <div className="flex items-center gap-2 font-mono text-xs text-[#7c8fa6]">
          <Clock size={13} className="text-[color:var(--accent)]" />
          <span className="tabular-nums text-[#c3d0e0]">{time}</span>
          <span className="hidden sm:inline">· {location} · WAT</span>
        </div>
      </div>
    </section>
  );
}
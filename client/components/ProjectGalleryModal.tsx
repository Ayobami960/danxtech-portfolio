"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as RMouseEvent,
  type PointerEvent as RPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  ExternalLink,
} from "lucide-react";
import { FaGithub } from "react-icons/fa6";
import LoadingSpinner from "./ui/LoadingSpinner";

const AUTOPLAY_MS = 5000;

export type GalleryProject = {
  title: string;
  icon?: string;
  accentColor: string;
  imageBox: readonly string[];
  imageParent?: string;
  description?: string;
  tech?: readonly string[];
  liveUrl?: string;
  githubUrl?: string;
};

const iconBtn =
  "flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/4 text-[#9db0c6] transition-colors hover:border-white/30 hover:text-white";

export default function ProjectGalleryModal({
  project,
  startIndex = 0,
  onClose,
}: {
  project: GalleryProject;
  startIndex?: number;
  onClose: () => void;
}) {
  const images = useMemo(
    () =>
      project.imageBox?.length
        ? [...project.imageBox]
        : project.imageParent
        ? [project.imageParent]
        : [],
    [project]
  );
  const total = images.length;
  const accent = project.accentColor || "#3b82f6";

  const [index, setIndex] = useState(Math.min(startIndex, Math.max(total - 1, 0)));
  const [prev, setPrev] = useState<number | null>(null);
  const [dir, setDir] = useState<0 | 1 | -1>(0);
  const [closing, setClosing] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  const [failed, setFailed] = useState<Record<number, boolean>>({});
  const [fsSupported] = useState(
    () => typeof document !== "undefined" && !!document.fullscreenEnabled,
  );
  const [isFs, setIsFs] = useState(false);
  const [reduce] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ x: 0, dx: 0, active: false, moved: false });

  /* ------------------------------------------------------------ */
  /* Navigation                                                    */
  /* ------------------------------------------------------------ */
  const go = (to: number, d: 1 | -1) => {
    if (total < 2) return;
    const n = ((to % total) + total) % total;
    if (n === index) return;
    setDir(d);
    setPrev(reduce ? null : index);
    setIndex(n);
    setZoomed(false);
  };

  const close = () => {
    if (closing) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    setClosing(true);
    window.setTimeout(onClose, reduce ? 0 : 240);
  };

  /* Latest-values ref so the key handler never goes stale */
  const latest = useRef({ go, close, zoomed, index, total });
  useEffect(() => {
    latest.current = { go, close, zoomed, index, total };
  });

  /* ------------------------------------------------------------ */
  /* Mount effects                                                 */
  /* ------------------------------------------------------------ */
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    document.body.style.overflow = "hidden";

    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);

    const onKey = (e: KeyboardEvent) => {
      const L = latest.current;
      const onButton = (e.target as HTMLElement).closest?.("button, a");

      if (e.key === "Escape") {
        e.preventDefault();
        if (L.zoomed) setZoomed(false);
        else L.close();
      } else if (e.key === "ArrowRight") {
        L.go(L.index + 1, 1);
      } else if (e.key === "ArrowLeft") {
        L.go(L.index - 1, -1);
      } else if (e.key === "Home") {
        L.go(0, -1);
      } else if (e.key === "End") {
        L.go(L.total - 1, 1);
      } else if (e.key === " " && !onButton && L.total > 1) {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "Tab" && dialogRef.current) {
        const f = [
          ...dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]"),
        ].filter((el) => el.offsetParent !== null);
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
      document.body.style.overflow = "";
      opener?.focus?.();
    };
  }, []);

  /* Preload neighbours */
  useEffect(() => {
    if (total < 2) return;
    [index + 1, index - 1].forEach((i) => {
      const im = new Image();
      im.src = images[((i % total) + total) % total];
    });
  }, [index, images, total]);

  /* Keep the active thumbnail centred (scroll the strip, not the page) */
  useEffect(() => {
    const box = thumbsRef.current;
    const el = box?.children[index] as HTMLElement | undefined;
    if (!box || !el) return;
    box.scrollTo({
      left: el.offsetLeft - (box.clientWidth - el.clientWidth) / 2,
      behavior: reduce ? "auto" : "smooth",
    });
  }, [index, reduce]);

  /* ------------------------------------------------------------ */
  /* Stage interactions: swipe + click-to-zoom                     */
  /* ------------------------------------------------------------ */
  const setOrigin = (e: { clientX: number; clientY: number }, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    if (imgRef.current) {
      imgRef.current.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${
        ((e.clientY - r.top) / r.height) * 100
      }%`;
    }
  };

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (zoomed || total < 2 || (e.target as HTMLElement).closest("button")) return;
    drag.current = { x: e.clientX, dx: 0, active: true, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    if (dragRef.current) dragRef.current.style.transition = "none";
  };

  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (zoomed) return setOrigin(e, e.currentTarget);
    const d = drag.current;
    if (!d.active) return;
    d.dx = e.clientX - d.x;
    if (Math.abs(d.dx) > 6) d.moved = true;
    if (dragRef.current) {
      dragRef.current.style.transform = `translateX(${d.dx * 0.7}px) rotate(${d.dx * 0.012}deg)`;
    }
  };

  const endDrag = () => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    setDragging(false);
    if (dragRef.current) {
      dragRef.current.style.transition = "transform .35s cubic-bezier(.2,.8,.2,1)";
      dragRef.current.style.transform = "";
    }
    if (Math.abs(d.dx) > 70) (d.dx < 0 ? go(index + 1, 1) : go(index - 1, -1));
  };

  const onStageClick = (e: RMouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    if (drag.current.moved) {
      drag.current.moved = false;
      return;
    }
    setOrigin(e, e.currentTarget);
    setZoomed((z) => !z);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else dialogRef.current?.requestFullscreen?.();
  };

  const markLoaded = (i: number) => setLoaded((l) => (l[i] ? l : { ...l, [i]: true }));
  const markFailed = (i: number) => setFailed((f) => (f[i] ? f : { ...f, [i]: true }));

  /* ------------------------------------------------------------ */
  /* Render                                                        */
  /* ------------------------------------------------------------ */
  const inClass = dir === 0 ? "lb-pop" : dir === 1 ? "lb-in-next" : "lb-in-prev";
  const outClass = dir === 1 ? "lb-out-next" : "lb-out-prev";
  const pad = (n: number) => String(n).padStart(2, "0");

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${project.title} gallery`}
      className={`lb-root fixed inset-0 z-100 flex items-center justify-center p-3 sm:p-6 ${
        closing ? "lb-closing" : ""
      }`}
    >
      <style>{CSS}</style>

      {/* backdrop + ambient glow from the current image */}
      <div
        aria-hidden
        onClick={close}
        className="lb-backdrop absolute inset-0 bg-[#05080f]/90 backdrop-blur-xl"
      />
      {total > 0 && (
        <img
          key={`amb-${index}`}
          aria-hidden
          alt=""
          src={images[index]}
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
          className="lb-fade pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-25 blur-3xl"
        />
      )}

      <div className="lb-panel relative flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c1329]/90 shadow-2xl shadow-black/60 backdrop-blur-xl">
        {/* ============ header ============ */}
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4! py-3! sm:px-5!">
          <div className="flex min-w-0 items-center gap-3">
            {project.icon && <span className="text-2xl">{project.icon}</span>}
            <div className="min-w-0">
              <h4 className="font-grotesk truncate font-bold text-white">{project.title}</h4>
              <p className="font-mono text-xs text-[#7c8fa6]" aria-live="polite">
                <span style={{ color: accent }}>{pad(index + 1)}</span> / {pad(total)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {project.liveUrl && (
              <a
                href={project.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden items-center gap-1.5 rounded-full border border-white/10 px-3.5! py-2! font-mono text-xs text-[#c3d0e0] transition-colors hover:border-white/30 hover:text-white sm:inline-flex"
              >
                <ExternalLink size={13} /> Live
              </a>
            )}
            {project.githubUrl && (
              <a
                href={project.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden items-center gap-1.5 rounded-full border border-white/10 px-3.5! py-2! font-mono text-xs text-[#c3d0e0] transition-colors hover:border-white/30 hover:text-white sm:inline-flex"
              >
                <FaGithub size={13} /> Source
              </a>
            )}

            {total > 1 && !reduce && (
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? "Pause slideshow" : "Play slideshow"}
                aria-pressed={playing}
                className={iconBtn}
                style={playing ? { color: accent, borderColor: `${accent}66` } : undefined}
              >
                {playing ? <Pause size={15} /> : <Play size={15} />}
              </button>
            )}
            {total > 0 && (
              <button
                type="button"
                onClick={() => setZoomed((z) => !z)}
                aria-label={zoomed ? "Zoom out" : "Zoom in"}
                className={iconBtn}
              >
                {zoomed ? <ZoomOut size={15} /> : <ZoomIn size={15} />}
              </button>
            )}
            {fsSupported && (
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFs ? "Exit full screen" : "Full screen"}
                className={`${iconBtn} hidden sm:flex`}
              >
                {isFs ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
            )}
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label="Close gallery"
              className={iconBtn}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* ============ stage ============ */}
        {total === 0 ? (
          <div className="flex h-[40vh] items-center justify-center font-mono text-sm text-[#7c8fa6]">
            No screenshots yet.
          </div>
        ) : (
          <div
            className="group/stage relative h-[50vh] select-none overflow-hidden bg-[#070b17] sm:h-[60vh]"
            style={{
              touchAction: "pan-y",
              cursor: zoomed ? "zoom-out" : dragging ? "grabbing" : "zoom-in",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClick={onStageClick}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
          >
            {/* leaving slide */}
            {prev !== null && prev !== index && (
              <div
                key={`out-${prev}`}
                className={`lb-slide ${outClass}`}
                onAnimationEnd={() => setPrev(null)}
              >
                <img
                  src={images[prev]}
                  alt=""
                  draggable={false}
                  onError={(event) => {
                    event.currentTarget.hidden = true;
                  }}
                  className="h-full w-full object-contain p-2 sm:p-4"
                />
              </div>
            )}

            {/* current slide (animation lives on .lb-slide, drag transform on the inner div) */}
            <div key={`in-${index}`} className={`lb-slide ${inClass}`}>
              <div ref={dragRef} className="h-full w-full">
                {!loaded[index] && (
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#0a1024]/60">
                    <LoadingSpinner
                      label="Loading screenshot"
                      size={28}
                      className="text-white/80"
                    />
                  </div>
                )}
                {failed[index] ? (
                  <div className="flex h-full w-full items-center justify-center font-mono text-sm text-[#7c8fa6]">
                    Screenshot unavailable
                  </div>
                ) : (
                  <img
                    ref={imgRef}
                    src={images[index]}
                    alt={`${project.title} screenshot ${index + 1} of ${total}`}
                    draggable={false}
                    onLoad={() => markLoaded(index)}
                    onError={() => {
                      markLoaded(index);
                      markFailed(index);
                    }}
                    className="h-full w-full object-contain p-2 sm:p-4"
                    style={{
                      transform: zoomed ? "scale(2.4)" : "scale(1)",
                      transition: "transform .4s cubic-bezier(.2,.8,.2,1)",
                    }}
                  />
                )}
              </div>
            </div>

            {/* arrows */}
            {total > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => go(index - 1, -1)}
                  aria-label="Previous image"
                  className="absolute left-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur transition-all duration-300 hover:scale-110 hover:bg-black/70 focus-visible:opacity-100 md:opacity-0 md:group-hover/stage:opacity-100"
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  type="button"
                  onClick={() => go(index + 1, 1)}
                  aria-label="Next image"
                  className="absolute right-3 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur transition-all duration-300 hover:scale-110 hover:bg-black/70 focus-visible:opacity-100 md:opacity-0 md:group-hover/stage:opacity-100"
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}

            {/* hint */}
            <span className="pointer-events-none absolute bottom-3 left-3 hidden rounded-full bg-black/55 px-3! py-1! font-mono text-[10px] text-white/70 backdrop-blur sm:block">
              {zoomed ? "Move to pan · click to zoom out" : total > 1 ? "Click to zoom · drag or ← → to browse" : "Click to zoom"}
            </span>

            {/* autoplay progress */}
            {playing && total > 1 && (
              <div className="absolute inset-x-0 bottom-0 h-0.75 bg-white/10">
                <span
                  key={index}
                  className="lb-progress block h-full origin-left"
                  style={{
                    background: accent,
                    animationDuration: `${AUTOPLAY_MS}ms`,
                    animationPlayState: hovering || zoomed || dragging ? "paused" : "running",
                  }}
                  onAnimationEnd={() => go(index + 1, 1)}
                />
              </div>
            )}
          </div>
        )}

        {/* ============ footer: info + thumbnails ============ */}
        <div className="border-t border-white/8 bg-[#0c1329]/80">
          {(project.description || project.tech?.length) && (
            <div className="flex flex-col gap-3 px-4! pt-4! sm:flex-row sm:items-start sm:justify-between sm:px-5!">
              {project.description && (
                <p className="line-clamp-2 max-w-2xl text-sm leading-relaxed text-[#8fa1b8]">
                  {project.description}
                </p>
              )}
              {!!project.tech?.length && (
                <div className="flex flex-wrap gap-1.5 sm:justify-end">
                  {project.tech.slice(0, 6).map((t) => (
                    <span
                      key={t}
                      className="rounded border border-white/8 bg-white/4 px-2! py-0.5! font-mono text-[11px] text-[#9db0c6]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {total > 1 && (
            <div
              ref={thumbsRef}
              className="relative flex gap-2.5 overflow-x-auto px-4! py-4! sm:px-5! [scrollbar-width:none]"
            >
              {images.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  onClick={() => go(i, i > index ? 1 : -1)}
                  aria-label={`Go to image ${i + 1}`}
                  aria-current={i === index}
                  className={`relative h-16 w-28 shrink-0 overflow-hidden rounded-lg border-2 transition-all duration-300 ${
                    i === index ? "scale-100 opacity-100" : "scale-95 opacity-50 hover:opacity-90"
                  }`}
                  style={
                    i === index
                      ? { borderColor: accent, boxShadow: `0 0 22px -4px ${accent}` }
                      : { borderColor: "transparent" }
                  }
                >
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                    }}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ================================================================== */
/* Animations                                                          */
/* ================================================================== */
const CSS = `
  @keyframes lb-backdrop     { from { opacity: 0; } to { opacity: 1; } }
  @keyframes lb-backdrop-out { to { opacity: 0; } }
  @keyframes lb-panel        { from { opacity: 0; transform: translateY(26px) scale(.96); } to { opacity: 1; transform: none; } }
  @keyframes lb-panel-out    { to { opacity: 0; transform: translateY(16px) scale(.97); } }
  @keyframes lb-pop          { from { opacity: 0; transform: scale(.92); } to { opacity: 1; transform: none; } }
  @keyframes lb-in-next      { from { opacity: 0; transform: translateX(80px) scale(.95); } to { opacity: 1; transform: none; } }
  @keyframes lb-in-prev      { from { opacity: 0; transform: translateX(-80px) scale(.95); } to { opacity: 1; transform: none; } }
  @keyframes lb-out-next     { to { opacity: 0; transform: translateX(-80px) scale(.95); } }
  @keyframes lb-out-prev     { to { opacity: 0; transform: translateX(80px) scale(.95); } }
  @keyframes lb-progress     { from { transform: scaleX(0); } to { transform: scaleX(1); } }

  .lb-backdrop { animation: lb-backdrop .3s ease both; }
  .lb-fade     { animation: lb-backdrop .6s ease both; }
  .lb-panel    { animation: lb-panel .45s cubic-bezier(.2,.8,.2,1) both; }
  .lb-slide    { position: absolute; inset: 0; }
  .lb-pop      { animation: lb-pop .5s cubic-bezier(.2,.8,.2,1) both; }
  .lb-in-next  { animation: lb-in-next .5s cubic-bezier(.2,.8,.2,1) both; }
  .lb-in-prev  { animation: lb-in-prev .5s cubic-bezier(.2,.8,.2,1) both; }
  .lb-out-next { animation: lb-out-next .4s cubic-bezier(.4,0,.2,1) both; pointer-events: none; }
  .lb-out-prev { animation: lb-out-prev .4s cubic-bezier(.4,0,.2,1) both; pointer-events: none; }
  .lb-progress { animation-name: lb-progress; animation-timing-function: linear; animation-fill-mode: both; }

  .lb-closing .lb-backdrop { animation: lb-backdrop-out .24s ease both; }
  .lb-closing .lb-panel    { animation: lb-panel-out .24s ease both; }

  @media (prefers-reduced-motion: reduce) {
    .lb-backdrop, .lb-fade, .lb-panel, .lb-pop, .lb-in-next, .lb-in-prev,
    .lb-out-next, .lb-out-prev { animation: none !important; }
  }
`;
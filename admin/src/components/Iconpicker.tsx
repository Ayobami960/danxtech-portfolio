import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "../lib/cn";

const GROUPS: { name: string; icons: string[] }[] = [
  { name: "Security and trust", icons: ["🛡️", "🔒", "🔐", "🔑", "🧱", "✅", "🕵️"] },
  { name: "Speed and performance", icons: ["⚡", "🚀", "⏱️", "🏎️", "📈", "🔋", "🌐"] },
  { name: "Craft and quality", icons: ["🎯", "🛠️", "🧩", "✨", "💎", "🧪", "📐", "🎨"] },
  { name: "People and care", icons: ["🤝", "💬", "❤️", "🌱", "🧠", "👀", "🙌"] },
  { name: "Process and clarity", icons: ["📝", "🗺️", "🔍", "♻️", "📦", "🧭", "📚"] },
];

/** Icon tile that opens a curated emoji picker, with a custom-emoji fallback. */
export const IconPicker = ({
  value,
  onChange,
  label = "Choose icon",
}: {
  value: string;
  onChange: (icon: string) => void;
  label?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent): void => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (icon: string): void => {
    onChange(icon);
    setCustom("");
    setOpen(false);
    trigger.current?.focus();
  };

  const useCustom = (): void => {
    const next = custom.trim();
    if (next) pick(next);
  };

  return (
    <div className="pr-picker" ref={root}>
      <button
        ref={trigger}
        type="button"
        className={cn("pr-icon", open && "open")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${label}. Current icon: ${value || "none"}`}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="pr-emoji">{value || "＋"}</span>
        <ChevronDown size={11} className="pr-caret" aria-hidden="true" />
      </button>

      {open ? (
        <div id={id} role="dialog" aria-label="Icon picker" className="pr-pop">
          {GROUPS.map((group) => (
            <div key={group.name}>
              <div className="pr-group">{group.name}</div>
              <div className="pr-grid">
                {group.icons.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    className={cn("pr-opt", icon === value && "on")}
                    aria-label={icon}
                    aria-pressed={icon === value}
                    onClick={() => pick(icon)}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="pr-custom">
            <label htmlFor={`${id}-custom`}>Or paste your own emoji</label>
            <div>
              <input
                id={`${id}-custom`}
                className="field"
                maxLength={8}
                value={custom}
                placeholder="🙂"
                onChange={(event) => setCustom(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    useCustom();
                  }
                }}
              />
              <button type="button" className="btn btn-ghost" onClick={useCustom}>
                Use
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
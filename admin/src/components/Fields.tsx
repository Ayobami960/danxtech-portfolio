import { X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { cn } from "../lib/cn";

export const Toggle = ({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  id?: string;
}) => (
  <button
    type="button"
    id={id}
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={cn(
      "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors",
      checked
        ? "border-[#3b82f6]/60 bg-[#3b82f6]/80"
        : "border-white/15 bg-white/5",
    )}
  >
    <span
      className={cn(
        "inline-block h-4 w-4 rounded-full bg-white transition-transform",
        checked ? "translate-x-6" : "translate-x-1",
      )}
    />
  </button>
);

export const TagInput = ({
  value,
  onChange,
  placeholder = "Add and press Enter",
  max = 40,
  maxLength = 60,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  max?: number;
  maxLength?: number;
}) => {
  const [draft, setDraft] = useState("");

  const add = (): void => {
    const tag = draft.trim();
    if (!tag || value.includes(tag) || value.length >= max) return;
    onChange([...value, tag]);
    setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add();
    }
    if (event.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-soft"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              className="text-muted hover:text-white"
              onClick={() => onChange(value.filter((item) => item !== tag))}
            >
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <input
        className="field mt-2"
        value={draft}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={add}
      />
    </div>
  );
};

export const ColorField = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="flex items-center gap-2">
    <input
      type="color"
      aria-label="Accent colour"
      value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#3b82f6"}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-12 cursor-pointer rounded-lg border border-white/10 bg-transparent"
    />
    <input
      className="field font-mono"
      value={value}
      maxLength={7}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Hex colour"
    />
  </div>
);

const EMOJI_SUGGESTIONS = 
["🚀", "🏠", "🛒", 
  "🔒", "⚔️", "🔐", "🧠", "🛡️", "🚚",
  "⚛️", "🛠️",  "🔍", "⚡", "🏗️",
   "🧪", "🤖", "🏛️", "🔧", "📉" , "✅", "🔗", "📊" 
  ];

export const EmojiField = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => (
  <div>
    <div className="flex items-center gap-2">
      <input
        className="field w-20 text-center text-xl"
        value={value}
        maxLength={16}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Icon"
      />
      <div className="flex flex-wrap gap-1">
        {EMOJI_SUGGESTIONS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="rounded-md border border-white/10 px-1.5 py-1 text-base hover:border-accent/40"
            onClick={() => onChange(emoji)}
            aria-label={`Use ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  </div>
);

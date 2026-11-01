import { X } from "lucide-react";
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { cn } from "../lib/cn";

export const Toggle = ({
  checked,
  onChange,
  label,
  id,
  small = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  id?: string;
  small?: boolean;
}) => (
  <button
    type="button"
    id={id}
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={cn("tgl", small && "sm")}
  />
);

export const TECH_SUGGESTIONS = [
  "React",
  "Next.js",
  "Node.js",
  "TypeScript",
  "PostgreSQL",
  "Redis",
  "Tailwind",
  "GraphQL",
  "Docker",
  "Python",
  "FastAPI",
  "WebSockets",
  "Mapbox",
  "D3",
];

type Option = { value: string; create: boolean };

export const TagInput = ({
  value,
  onChange,
  placeholder = "Add a technology",
  max = 40,
  maxLength = 60,
  suggestions = [],
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  max?: number;
  maxLength?: number;
  suggestions?: string[];
}) => {
  const listId = useId();
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);

  const options = useMemo<Option[]>(() => {
    const query = draft.trim().toLowerCase();
    const matches: Option[] = suggestions
      .filter(
        (item) =>
          !value.includes(item) && (!query || item.toLowerCase().includes(query)),
      )
      .slice(0, 5)
      .map((item) => ({ value: item, create: false }));
    const known = suggestions.map((item) => item.toLowerCase());
    if (query && !known.includes(query) && !value.includes(draft.trim())) {
      matches.push({ value: draft.trim(), create: true });
    }
    return matches;
  }, [draft, suggestions, value]);

  const open = focused && options.length > 0;
  const activeIndex = Math.min(active, Math.max(0, options.length - 1));

  const add = (raw: string): void => {
    const tag = raw.trim();
    if (!tag || value.includes(tag) || value.length >= max) {
      setDraft("");
      return;
    }
    onChange([...value, tag]);
    setDraft("");
    setActive(0);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(Math.min(options.length - 1, activeIndex + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(Math.max(0, activeIndex - 1));
    } else if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(open && options[activeIndex] ? options[activeIndex].value : draft);
    } else if (event.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    } else if (event.key === "Escape") {
      setFocused(false);
    }
  };

  return (
    <div>
      <div className="tags">
        {value.map((tag) => (
          <span key={tag} className="tag">
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => onChange(value.filter((item) => item !== tag))}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <div className="tbox">
        <input
          className="field"
          value={draft}
          maxLength={maxLength}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          onChange={(event) => {
            setDraft(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (draft.trim()) add(draft);
          }}
        />
        {open ? (
          <ul className="dd" id={listId} role="listbox">
            {options.map((option, index) => (
              <li
                key={`${option.create ? "new" : "known"}-${option.value}`}
                role="option"
                aria-selected={index === activeIndex}
                // mousedown (not click) so the input keeps focus and onBlur does not add the half-typed draft.
                onMouseDown={(event) => {
                  event.preventDefault();
                  add(option.value);
                }}
              >
                {option.create ? <em>Create </em> : null}
                {option.value}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
};

export const ACCENT_SWATCHES = [
  "#3b82f6",
  "#5eead4",
  "#f4b942",
  "#8d9bff",
  "#ff8272",
  "#f472b6",
  "#7dd3fc",
];

export const ColorField = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="sw">
    {ACCENT_SWATCHES.map((colour) => (
      <button
        key={colour}
        type="button"
        style={{ background: colour }}
        aria-label={`Colour ${colour}`}
        aria-pressed={colour.toLowerCase() === value.toLowerCase()}
        onClick={() => onChange(colour)}
      />
    ))}
    <input
      type="color"
      aria-label="Pick a colour"
      value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#3b82f6"}
      onChange={(event) => onChange(event.target.value)}
    />
    <input
      className="field"
      value={value}
      maxLength={7}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Hex colour"
    />
  </div>
);

const EMOJI_SUGGESTIONS = [
  "🚀", "🏠", "🛒", "🔒", "⚔️", "🔐", "🧠", "🛡️", "🚚", "⚛️", "🛠️",
  "🔍", "⚡", "🏗️", "🧪", "🤖", "🏛️", "🔧", "📉", "✅", "🔗", "📊",
];

export const EmojiField = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="em">
    <input
      className="field"
      value={value}
      maxLength={16}
      onChange={(event) => onChange(event.target.value)}
      aria-label="Icon"
    />
    {EMOJI_SUGGESTIONS.map((emoji) => (
      <button
        key={emoji}
        type="button"
        aria-pressed={emoji === value}
        aria-label={`Use ${emoji}`}
        onClick={() => onChange(emoji)}
      >
        {emoji}
      </button>
    ))}
  </div>
);

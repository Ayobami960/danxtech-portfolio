import React from "react";
import { cn } from "../lib/cn";

// Toggle and Switch share a rounded pill cursor switch.
export const Toggle = React.memo(({ checked, onChange, label, id }: { checked: boolean; onChange: (value: boolean) => void; label?: string; id?: string }) => (
  <button
    type="button"
    id={id}
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-0 bg-transparent transition-colors"
  >
    <span
      className={cn(
        "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
        checked ? "translate-x-[1.375rem] bg-accent" : "translate-x-[0.625rem] bg-white/40",
      )}
    />
  </button>
));
Toggle.displayName = "Toggle";

export const Switch = React.memo(({ checked, onChange, label, id }: { checked: boolean; onChange: (value: boolean) => void; label?: string; id?: string }) => (
  <button
    type="button"
    id={id}
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-0 bg-transparent transition-colors"
  >
    <span
      className={cn(
        "inline-block h-5 w-5 rounded-full bg-white/80 shadow-sm transition-transform",
        checked ? "translate-x-[1.375rem] bg-accent" : "translate-x-[0.625rem]",
      )}
    />
  </button>
));
Switch.displayName = "Switch";

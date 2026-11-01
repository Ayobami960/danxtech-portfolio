import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export const FormDialog = ({
  open,
  title,
  description,
  busy = false,
  submitLabel = "Save",
  onSubmit,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  busy?: boolean;
  submitLabel?: string;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
}) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="form-dialog-title"
    >
      <div className="window-card my-auto w-full max-w-lg p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="form-dialog-title"
              className="font-grotesk text-base font-semibold text-[var(--color-on-card)]"
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm text-[var(--color-soft)]">{description}</p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="rounded-md p-1 text-[var(--color-soft)] hover:bg-[var(--color-section)] hover:text-[var(--color-accent)]"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <form
          className="mt-4 space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          {children}
          <div className="mt-4 flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Saving…" : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

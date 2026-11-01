import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

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
      className="ov"
      role="dialog"
      aria-modal="true"
      aria-labelledby="form-dialog-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog wide">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="form-dialog-title">{title}</h2>
            {description ? <p className="d">{description}</p> : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="ib"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X />
          </button>
        </div>

        <form
          className="form-stack mt-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          {children}
          <div className="a dialog-actions flex justify-end gap-2 pt-1">
            <button type="button" className="btn" onClick={onClose}>
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

import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { cn } from "../lib/cn";

const RING = 150.8; // circumference of r=24

/**
 * Drop zone with a progress ring (reference: "Upload with progress ring").
 * Validates type and size client-side, then hands the accepted files to `onFiles`.
 * The upload itself stays with the caller, so the Cloudinary flow is untouched.
 */
export const UploadDrop = ({
  label,
  hint,
  accept,
  maxSizeBytes,
  multiple = false,
  disabled = false,
  uploading = false,
  progress = 0,
  onFiles,
}: {
  label: string;
  hint: string;
  /** Allowed MIME types. */
  accept: readonly string[];
  maxSizeBytes: number;
  multiple?: boolean;
  disabled?: boolean;
  uploading?: boolean;
  /** 0–100 while `uploading`. */
  progress?: number;
  onFiles: (files: File[]) => void;
}) => {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handle = (list: FileList | File[]): void => {
    const accepted = Array.from(list).filter((file) => {
      if (!accept.includes(file.type)) {
        toast.error(`${file.name}: unsupported file type`);
        return false;
      }
      if (file.size > maxSizeBytes) {
        toast.error(`${file.name}: file is too large`);
        return false;
      }
      return true;
    });
    if (accepted.length === 0) return;
    onFiles(multiple ? accepted : accepted.slice(0, 1));
  };

  const onDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setOver(false);
    if (!disabled) handle(event.dataTransfer.files);
  };

  const pct = Math.round(Math.max(0, Math.min(100, progress)));

  return (
    <div
      className={cn("drop", over && "over", disabled && "off")}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <div className="rgp" aria-hidden>
        <svg viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="24" fill="none" stroke="var(--line2)" strokeWidth="4" />
          <circle
            className="arc"
            cx="28"
            cy="28"
            r="24"
            fill="none"
            stroke="var(--acc)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={RING}
            strokeDashoffset={RING * (1 - (uploading ? pct : 0) / 100)}
            transform="rotate(-90 28 28)"
          />
        </svg>
        <span>{uploading ? `${pct}%` : "↑"}</span>
      </div>
      <div className="min-w-0">
        <p>{label}</p>
        <small>{hint}</small>
        <button
          type="button"
          className="btn"
          disabled={disabled}
          onClick={() => input.current?.click()}
        >
          {multiple ? "Choose files" : "Choose file"}
        </button>
      </div>
      <input
        ref={input}
        type="file"
        hidden
        multiple={multiple}
        accept={accept.join(",")}
        onChange={(event) => {
          if (event.target.files?.length) handle(event.target.files);
          event.target.value = "";
        }}
      />
      <span className="sr-only-live" role="status">
        {uploading ? `Uploading ${pct}%` : ""}
      </span>
    </div>
  );
};

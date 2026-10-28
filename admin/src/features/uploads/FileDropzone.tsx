import { UploadCloud } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";
import { cn } from "../../lib/cn";
import { isAcceptedFile } from "./accept";

export const FileDropzone = ({
  accept,
  multiple = false,
  maxSizeBytes,
  label,
  hint,
  onFiles,
  disabled,
}: {
  accept: string;
  multiple?: boolean;
  maxSizeBytes: number;
  label: string;
  hint?: string;
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) => {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handle = (files: FileList | null): void => {
    if (!files) return;
    const list = Array.from(files);
    const accepted = list.filter((file) => {
      if (!isAcceptedFile(file, accept)) {
        toast.error(`${file.name}: unsupported file type.`);
        return false;
      }
      if (file.size > maxSizeBytes) {
        toast.error(`${file.name}: file is too large.`);
        return false;
      }
      return true;
    });
    if (accepted.length > 0) onFiles(multiple ? accepted : accepted.slice(0, 1));
  };

  const onDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setOver(false);
    if (!disabled) handle(event.dataTransfer.files);
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn(
        "rounded-xl border border-dashed p-4 text-center transition-colors",
        over ? "border-[#3b82f6]/60 bg-[#3b82f6]/5" : "border-white/15",
        disabled && "opacity-60",
      )}
    >
      <UploadCloud size={20} className="mx-auto text-[#3b82f6]" />
      <p className="mt-2 text-sm text-[#cbd8e8]">{label}</p>
      <p className="mt-0.5 font-mono text-[10px] text-[#5f7189]">{hint}</p>
      <button
        type="button"
        className="btn btn-ghost mt-3"
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        Choose {multiple ? "files" : "file"}
      </button>
      <input
        ref={input}
        type="file"
        className="sr-only"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => {
          handle(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
};

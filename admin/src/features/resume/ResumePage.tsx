import { Download, ExternalLink, FileText, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useDeleteResumeMutation, useGetResumeQuery } from "../../api/adminApi";
import { errorMessage } from "../../api/errors";
import { API_ORIGIN } from "../../app/config";
import { useAppDispatch, useAppSelector } from "../../app/hooks";
import { Card } from "../../components/Card";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PageHeader } from "../../components/PageHeader";
import { EmptyState, ErrorState, LoadingList } from "../../components/States";
import { formatBytes, formatDate } from "../../lib/format";
import { ACCEPT_PDF, isAcceptedFile } from "../uploads/accept";
import { FileDropzone } from "../uploads/FileDropzone";
import { cancelUpload, uploadFile } from "../uploads/uploadFile";
import { uploadsSelectors } from "../uploads/uploadsSlice";

const MAX_PDF_BYTES = 25 * 1024 * 1024;

export default function ResumePage() {
  const dispatch = useAppDispatch();
  const query = useGetResumeQuery();
  const [remove, removeState] = useDeleteResumeMutation();
  const [confirming, setConfirming] = useState(false);
  const uploads = useAppSelector((state) =>
    uploadsSelectors.selectAll(state.uploads).filter((entry) => entry.kind === "resume"),
  );

  const info = query.data && query.data.available ? query.data : null;
  const downloadUrl = `${API_ORIGIN}/api/v1/resume/download`;
  const previewUrl = `${API_ORIGIN}/api/v1/resume/download?inline=1`;
  const uploading = uploads.some((entry) => entry.status === "uploading");

  const onFiles = (files: File[]): void => {
    const file = files[0];
    if (!file) return;
    if (!isAcceptedFile(file, ACCEPT_PDF)) {
      toast.error("The resume must be a PDF.");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      toast.error("The resume must be 25 MB or smaller.");
      return;
    }
    void dispatch(uploadFile({ file, kind: "resume" }))
      .unwrap()
      .then(() => toast.success(info ? "Resume replaced" : "Resume uploaded"))
      .catch((error: unknown) => toast.error(errorMessage(error, "Upload failed.")));
  };

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Resume"
        description="The single PDF served by the download button on the public site. Uploading a new file replaces the old one."
      />

      {query.isLoading ? (
        <LoadingList rows={3} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card title="current_file">
            {info ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#3b82f6]">
                    <FileText size={20} />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">
                      {info.fileName}
                    </div>
                    <div className="font-mono text-[10px] text-[#5f7189]">
                      {formatBytes(info.sizeBytes)} · uploaded {formatDate(info.uploadedAt)}
                    </div>
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg border border-white/10 p-3">
                    <dt className="font-mono text-[10px] uppercase text-[#7c8fa6]">
                      Downloads
                    </dt>
                    <dd className="mt-1 font-grotesk text-xl font-bold text-white">
                      {info.downloadCount}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-white/10 p-3">
                    <dt className="font-mono text-[10px] uppercase text-[#7c8fa6]">
                      Last updated
                    </dt>
                    <dd className="mt-1 text-xs text-[#cbd8e8]">
                      {formatDate(info.updatedAt)}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-2">
                  <a
                    className="btn btn-ghost"
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={14} /> Preview
                  </a>
                  <a className="btn btn-ghost" href={downloadUrl} download>
                    <Download size={14} /> Download
                  </a>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => setConfirming(true)}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            ) : (
              <EmptyState
                title="No resume uploaded"
                description="Upload a PDF and the download button appears on the public site."
                icon={<FileText size={24} />}
              />
            )}
          </Card>

          <Card title={info ? "replace_file" : "upload_file"}>
            <FileDropzone
              accept={ACCEPT_PDF}
              maxSizeBytes={MAX_PDF_BYTES}
              label="Drop a PDF here (max 25 MB)"
              hint={
                info
                  ? "Replacing is safe: the new file is stored before the old one is deleted."
                  : "PDF only. The file is validated on the client and the server."
              }
              disabled={uploading}
              onFiles={onFiles}
            />
            {uploads.length > 0 ? (
              <div className="mt-3 space-y-2">
                {uploads.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-white/10 p-2">
                    <div className="flex justify-between text-[11px] text-[#9db0c6]">
                      <span className="truncate">{entry.name}</span>
                      <span>{entry.status === "done" ? "done" : `${entry.progress}%`}</span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded bg-white/10">
                      <div
                        className="h-full bg-[#3b82f6]"
                        style={{ width: `${entry.progress}%` }}
                      />
                    </div>
                    {entry.status === "uploading" ? (
                      <button
                        type="button"
                        className="mt-1 text-[10px] text-red-300"
                        onClick={() => cancelUpload(entry.id)}
                      >
                        Cancel
                      </button>
                    ) : null}
                    {entry.error ? (
                      <p className="mt-1 text-[10px] text-red-300">{entry.error}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            <p className="mt-4 text-[11px] text-[#5f7189]">
              The public resume button is hidden automatically while no file exists.
            </p>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title="Delete the resume?"
        description="The file is removed from storage and the download button disappears from the public site."
        busy={removeState.isLoading}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          void remove()
            .unwrap()
            .then(() => {
              toast.success("Resume deleted");
              setConfirming(false);
            })
            .catch((error: unknown) => toast.error(errorMessage(error)));
        }}
      />
    </>
  );
}

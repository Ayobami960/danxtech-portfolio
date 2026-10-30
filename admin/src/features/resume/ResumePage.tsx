import { Download, ExternalLink, FileText, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useDeleteResumeMutation,
  useGetResumeQuery,
  useUpdateResumeMutation,
} from "../../api/adminApi";
import { errorMessage } from "../../api/errors";
import { API_ORIGIN } from "../../app/config";
import { Card } from "../../components/Card";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { PageHeader } from "../../components/PageHeader";
import { EmptyState, ErrorState, LoadingList } from "../../components/States";
import { formatBytes, formatDate } from "../../lib/format";
import { ACCEPT_PDF, isAcceptedFile } from "../uploads/accept";
import { FileDropzone } from "../uploads/FileDropzone";
import { MAX_UPLOAD_BYTES, uploadToCloudinary } from "../../lib/cloudinary";

/** Matches the limit the upload helper enforces for the resume preset. */
const MAX_PDF_BYTES = MAX_UPLOAD_BYTES;

export default function ResumePage() {
  const query = useGetResumeQuery();
  const [remove, removeState] = useDeleteResumeMutation();
  const [update, updateState] = useUpdateResumeMutation();
  const [confirming, setConfirming] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const info = query.data && query.data.available ? query.data : null;
  const downloadUrl = `${API_ORIGIN}/api/v1/resume/download`;
  const previewUrl = `${API_ORIGIN}/api/v1/resume/download?inline=1`;

  const onFiles = (files: File[]): void => {
    const file = files[0];
    if (!file) return;
    if (!isAcceptedFile(file, ACCEPT_PDF)) {
      toast.error("The resume must be a PDF.");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      toast.error(`The resume must be ${formatBytes(MAX_PDF_BYTES)} or smaller.`);
      return;
    }

    void (async () => {
      setUploading(true);
      setProgress(0);
      setUploadError(null);
      try {
        // Browser -> Cloudinary, then the API stores only the result. No PDF
        // bytes pass through the backend. The preset overwrites one fixed
        // public_id, so the previous object is replaced in place and is never
        // deleted afterwards.
        const result = await uploadToCloudinary(file, "resume", setProgress);
        await update({
          url: result.url,
          publicId: result.publicId,
        }).unwrap();
        toast.success(info ? "Resume replaced" : "Resume uploaded");
      } catch (error) {
        const message = errorMessage(error, "Upload failed.");
        setUploadError(message);
        toast.error(message);
      } finally {
        setUploading(false);
      }
    })();
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
              label={`Drop a PDF here (max ${formatBytes(MAX_PDF_BYTES)})`}
              hint={
                info
                  ? "Uploading replaces the file Cloudinary already serves."
                  : "PDF only. The file goes straight to Cloudinary, never through the API."
              }
              disabled={uploading || updateState.isLoading}
              onFiles={onFiles}
            />
            {uploading ? (
              <p className="mt-3 text-[11px] text-[#9db0c6]">Uploading… {progress}%</p>
            ) : null}
            {uploadError ? (
              <p className="mt-3 text-[11px] text-red-300">{uploadError}</p>
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

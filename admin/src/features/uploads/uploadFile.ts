import { createAsyncThunk } from "@reduxjs/toolkit";
import { API_BASE } from "../../app/config";
import type { RootState } from "../../app/store";
import { refreshSession } from "../../api/client";
import { adminApi } from "../../api/adminApi";
import { setCsrfToken } from "../auth/authSlice";
import {
  uploadAdded,
  uploadFinished,
  uploadProgress,
  type UploadKind,
} from "./uploadsSlice";

export type UploadInput = {
  file: File;
  kind: UploadKind;
  targetId?: string;
};

const active = new Map<string, XMLHttpRequest>();

export const cancelUpload = (id: string): void => {
  active.get(id)?.abort();
};

const endpointFor = (input: UploadInput): string => {
  if (input.kind === "resume") return `${API_BASE}/admin/resume`;
  if (!input.targetId) throw new Error("A project is required for this upload.");
  if (input.kind === "cover") {
    return `${API_BASE}/admin/projects/${input.targetId}/cover`;
  }
  return `${API_BASE}/admin/projects/${input.targetId}/gallery`;
};

const fieldFor = (input: UploadInput): string =>
  input.kind === "gallery" ? "files" : "file";

type XhrResult = { ok: boolean; status: number; payload: unknown };

const send = (
  input: UploadInput,
  id: string,
  csrfToken: string | null,
  onProgress: (progress: number) => void,
): Promise<XhrResult> =>
  new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    active.set(id, xhr);
    xhr.open(input.kind === "resume" ? "PUT" : "POST", endpointFor(input), true);
    xhr.withCredentials = true;
    xhr.setRequestHeader("accept", "application/json");
    if (csrfToken) xhr.setRequestHeader("x-csrf-token", csrfToken);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      active.delete(id);
      let payload: unknown;
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        payload = null;
      }
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        payload,
      });
    };

    xhr.onerror = () => {
      active.delete(id);
      resolve({ ok: false, status: 0, payload: null });
    };

    xhr.onabort = () => {
      active.delete(id);
      resolve({ ok: false, status: -1, payload: null });
    };

    const form = new FormData();
    form.append(fieldFor(input), input.file, input.file.name);
    xhr.send(form);
  });

const errorFrom = (payload: unknown): string => {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof (payload as { error?: { message?: unknown } }).error?.message === "string"
  ) {
    return (payload as { error: { message: string } }).error.message;
  }
  return "Upload failed. Please try again.";
};

export const uploadFile = createAsyncThunk<
  { id: string },
  UploadInput,
  { state: RootState }
>(
  "uploads/uploadFile",
  async (input, { dispatch, getState, rejectWithValue }) => {
    const id = crypto.randomUUID();
    dispatch(
      uploadAdded({
        id,
        name: input.file.name,
        size: input.file.size,
        kind: input.kind,
        ...(input.targetId ? { targetId: input.targetId } : {}),
        progress: 0,
        status: "uploading",
      }),
    );

    const onProgress = (progress: number) => {
      dispatch(uploadProgress({ id, progress }));
    };

    try {
      let csrf = getState().auth.csrfToken;
      let result = await send(input, id, csrf, onProgress);

      if (result.status === 401) {
        const refreshed = await refreshSession(csrf);
        if (refreshed.csrfToken) {
          csrf = refreshed.csrfToken;
          dispatch(setCsrfToken(csrf));
        }
        if (refreshed.ok) {
          onProgress(0);
          result = await send(input, id, csrf, onProgress);
        }
      }

      if (!result.ok) {
        if (result.status === -1) {
          dispatch(uploadFinished({ id, status: "cancelled" }));
          return rejectWithValue({ message: "Upload cancelled." });
        }
        const message = errorFrom(result.payload);
        dispatch(uploadFinished({ id, status: "failed", error: message }));
        return rejectWithValue({ message });
      }

      dispatch(uploadFinished({ id, status: "done" }));

      if (input.kind === "resume") {
        dispatch(adminApi.util.invalidateTags(["Resume", "Stats"]));
      } else if (input.targetId) {
        dispatch(
          adminApi.util.invalidateTags([
            { type: "Project", id: input.targetId },
            { type: "ProjectImage", id: input.targetId },
            { type: "Project", id: "LIST" },
          ]),
        );
      }

      return { id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      dispatch(uploadFinished({ id, status: "failed", error: message }));
      return rejectWithValue({ message });
    }
  },
);

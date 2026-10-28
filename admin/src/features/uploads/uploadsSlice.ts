import {
  createEntityAdapter,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";

export type UploadKind = "cover" | "gallery" | "resume";

export type UploadEntry = {
  id: string;
  name: string;
  size: number;
  kind: UploadKind;
  targetId?: string;
  progress: number;
  status: "uploading" | "done" | "failed" | "cancelled";
  error?: string;
};

const adapter = createEntityAdapter<UploadEntry>();

const uploadsSlice = createSlice({
  name: "uploads",
  initialState: adapter.getInitialState(),
  reducers: {
    uploadAdded(state, action: PayloadAction<UploadEntry>) {
      adapter.upsertOne(state, action.payload);
    },
    uploadProgress(
      state,
      action: PayloadAction<{ id: string; progress: number }>,
    ) {
      adapter.updateOne(state, {
        id: action.payload.id,
        changes: { progress: action.payload.progress },
      });
    },
    uploadFinished(
      state,
      action: PayloadAction<{ id: string; status: UploadEntry["status"]; error?: string }>,
    ) {
      adapter.updateOne(state, {
        id: action.payload.id,
        changes: {
          status: action.payload.status,
          progress: action.payload.status === "done" ? 100 : undefined,
          ...(action.payload.error ? { error: action.payload.error } : {}),
        },
      });
    },
    uploadRemoved(state, action: PayloadAction<string>) {
      adapter.removeOne(state, action.payload);
    },
    uploadsCleared() {
      return adapter.getInitialState();
    },
  },
});

export const {
  uploadAdded,
  uploadProgress,
  uploadFinished,
  uploadRemoved,
  uploadsCleared,
} = uploadsSlice.actions;

export const uploadsSelectors = adapter.getSelectors();

export default uploadsSlice.reducer;

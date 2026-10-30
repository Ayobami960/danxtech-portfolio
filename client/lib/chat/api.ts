import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL, API_PREFIX } from "../api/client";
import { getGuestToken } from "./session";
import type {
  JoinResponse,
  MessagePage,
  RawChatMessage,
  VerificationRequestResult,
  VerifyResponse,
} from "./types";

const authHeaders = (): Record<string, string> => {
  const token = getGuestToken();
  return token ? { authorization: `Bearer ${token}` } : {};
};

const jsonHeaders = (): Record<string, string> => ({
  "content-type": "application/json",
  ...authHeaders(),
});

export const chatApi = createApi({
  reducerPath: "chatApi",
  baseQuery: fetchBaseQuery({ baseUrl: `${API_BASE_URL}${API_PREFIX}` }),
  endpoints: (build) => ({
    /** Step 1: ask for a code. The answer is deliberately generic. */
    requestCode: build.mutation<
      VerificationRequestResult,
      { conversationId: string; token: string; email: string }
    >({
      query: (body) => ({
        url: "/chat/verify/request",
        method: "POST",
        body,
        headers: { "content-type": "application/json" },
      }),
    }),
    /** Step 2: confirm the code and receive the visitor session. */
    confirmCode: build.mutation<
      VerifyResponse,
      { conversationId: string; token: string; email: string; code: string }
    >({
      query: (body) => ({
        url: "/chat/verify/confirm",
        method: "POST",
        body,
        headers: { "content-type": "application/json" },
      }),
    }),
    /** Rejoin an already verified session. */
    join: build.mutation<JoinResponse, void>({
      query: () => ({
        url: "/chat/join",
        method: "POST",
        body: {},
        headers: jsonHeaders(),
      }),
    }),
    logout: build.mutation<void, void>({
      query: () => ({
        url: "/chat/logout",
        method: "POST",
        headers: authHeaders(),
      }),
    }),
    getMessages: build.query<MessagePage, { before?: number; after?: number }>({
      query: (args) => ({
        url: "/chat/messages",
        params: {
          limit: 50,
          ...(args.before ? { before: args.before } : {}),
          ...(args.after !== undefined ? { after: args.after } : {}),
        },
        headers: authHeaders(),
      }),
    }),
    sendMessage: build.mutation<
      RawChatMessage,
      {
        clientMsgId: string;
        body: string;
        imageKey?: string;
        imageMimeType?: string;
        attachmentName?: string;
      }
    >({
      query: (body) => ({
        url: "/chat/messages",
        method: "POST",
        body,
        headers: jsonHeaders(),
      }),
    }),
    markSeen: build.mutation<
      { upToSeq: number; readAt: string | null },
      { upToSeq: number }
    >({
      query: (body) => ({
        url: "/chat/seen",
        method: "POST",
        body,
        headers: jsonHeaders(),
      }),
    }),
  }),
});

export const {
  useRequestCodeMutation,
  useConfirmCodeMutation,
  useJoinMutation,
  useLogoutMutation,
  useLazyGetMessagesQuery,
  useSendMessageMutation,
  useMarkSeenMutation,
} = chatApi;

export type ChatAttachment = {
  /** Cloudinary public_id, stored on the message as `imageKey`. */
  key: string;
  /** Cloudinary `secure_url`, used for the optimistic preview. */
  url: string;
  name: string;
  mimeType: string;
  resourceType: "image" | "raw";
};

/** Cloudinary's upload cap; checked before a signature is requested. */
export const MAX_CHAT_ATTACHMENT_BYTES = 5 * 1024 * 1024;

type SignResponse = {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  resourceType: "image" | "raw";
  params: Record<string, string>;
};

type CloudinaryUploadPayload = {
  secure_url?: string;
  public_id?: string;
  error?: { message?: string };
};

const responseError = async (response: Response, fallback: string): Promise<string> => {
  const payload: unknown = await response.json().catch(() => null);
  const message =
    typeof payload === "object" &&
    payload !== null &&
    typeof (payload as { error?: { message?: unknown } }).error?.message === "string"
      ? (payload as { error: { message: string } }).error.message
      : null;
  return message ?? fallback;
};

/**
 * Upload one attachment (image or PDF) straight to Cloudinary:
 *   1. `POST /chat/uploads/sign` with the resource type; the API signs the
 *      visitor's own conversation folder.
 *   2. Forward every signed param unchanged, then api_key, timestamp,
 *      signature and the file.
 * Kept out of RTK Query because the body is multipart.
 */
export const uploadChatAttachment = async (file: File): Promise<ChatAttachment> => {
  if (file.size > MAX_CHAT_ATTACHMENT_BYTES) {
    throw new Error(`${file.name}: the file must be 5 MB or smaller.`);
  }

  const resourceType: "image" | "raw" = file.type.startsWith("image/")
    ? "image"
    : "raw";

  const signResponse = await fetch(`${API_BASE_URL}${API_PREFIX}/chat/uploads/sign`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ resourceType }),
  });

  if (!signResponse.ok) {
    throw new Error(
      await responseError(signResponse, "The attachment could not be uploaded."),
    );
  }

  const signed = (await signResponse.json()) as SignResponse;
  const form = new FormData();
  for (const [key, value] of Object.entries(signed.params)) {
    form.append(key, value);
  }
  form.append("api_key", signed.apiKey);
  form.append("timestamp", String(signed.timestamp));
  form.append("signature", signed.signature);
  form.append("file", file, file.name);

  const upload = await fetch(
    `https://api.cloudinary.com/v1_1/${signed.cloudName}/${signed.resourceType}/upload`,
    { method: "POST", body: form },
  );

  const payload = (await upload.json().catch(() => ({}))) as CloudinaryUploadPayload;
  if (!upload.ok) {
    throw new Error(payload.error?.message ?? "Cloudinary rejected the upload.");
  }
  if (typeof payload.secure_url !== "string" || typeof payload.public_id !== "string") {
    throw new Error("Cloudinary did not return the expected upload result.");
  }

  return {
    key: payload.public_id,
    url: payload.secure_url,
    name: file.name,
    mimeType:
      file.type || (resourceType === "image" ? "image/jpeg" : "application/pdf"),
    resourceType: signed.resourceType,
  };
};

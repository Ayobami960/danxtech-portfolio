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
      { clientMsgId: string; body: string; imageKey?: string }
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

/**
 * Upload one image through the backend (ImageKit on the server). Kept out of
 * RTK Query because the body is multipart.
 */
export const uploadChatImage = async (
  file: File,
): Promise<{ key: string; url: string }> => {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE_URL}${API_PREFIX}/chat/images`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message =
      typeof payload === "object" &&
      payload !== null &&
      typeof (payload as { error?: { message?: unknown } }).error?.message ===
        "string"
        ? (payload as { error: { message: string } }).error.message
        : "The image could not be uploaded.";
    throw new Error(message);
  }

  return (await response.json()) as { key: string; url: string };
};

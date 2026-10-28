import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "../config";
import type { Ack, RawChatMessage } from "./types";

export type ChatHandlers = {
  onConnect: () => void;
  onDisconnect: () => void;
  onConnectError: () => void;
  onMessage: (message: RawChatMessage) => void;
  onStatus: (payload: { upToSeq: number; readAt: string | null }) => void;
  onTyping: (isTyping: boolean) => void;
  onPresence: (adminOnline: boolean) => void;
  onClosed: () => void;
  onRevoked: () => void;
};

let socket: Socket | null = null;

export const connectChat = (token: string, handlers: ChatHandlers): void => {
  disconnectChat();
  socket = io(`${API_BASE_URL}/chat`, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    autoConnect: true,
  });

  socket.on("connect", handlers.onConnect);
  socket.on("disconnect", handlers.onDisconnect);
  socket.on("connect_error", handlers.onConnectError);
  socket.on("message:new", (payload: { message?: RawChatMessage }) => {
    if (payload?.message) handlers.onMessage(payload.message);
  });
  socket.on("message:status", (payload: { upToSeq?: number; readAt?: string | null }) => {
    if (typeof payload?.upToSeq === "number") {
      handlers.onStatus({ upToSeq: payload.upToSeq, readAt: payload.readAt ?? null });
    }
  });
  socket.on("typing", (payload: { from?: string; isTyping?: boolean }) => {
    if (payload?.from === "admin") handlers.onTyping(Boolean(payload.isTyping));
  });
  socket.on("presence", (payload: { adminOnline?: boolean }) => {
    handlers.onPresence(Boolean(payload?.adminOnline));
  });
  socket.on("chat:closed", handlers.onClosed);
  socket.on("invite:revoked", handlers.onRevoked);
};

export const disconnectChat = (): void => {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
};

export const isChatLive = (): boolean => socket?.connected ?? false;

export const sendOverSocket = (
  payload: { clientMsgId: string; body: string; imageKey?: string },
  timeoutMs = 8_000,
): Promise<Ack> =>
  new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ ok: false, error: { code: "OFFLINE", message: "Not connected." } });
      return;
    }
    socket.timeout(timeoutMs).emit(
      "message:send",
      payload,
      (error: Error | null, ack?: Ack) => {
        if (error) {
          resolve({ ok: false, error: { code: "TIMEOUT", message: "Message timed out." } });
          return;
        }
        resolve(ack ?? { ok: false, error: { code: "SEND_FAILED", message: "No response." } });
      },
    );
  });

export const emitTyping = (conversationId: string, isTyping: boolean): void => {
  socket?.emit("typing", { conversationId, isTyping });
};

export const emitSeen = (conversationId: string, upToSeq: number): void => {
  socket?.emit("seen", { conversationId, upToSeq });
};

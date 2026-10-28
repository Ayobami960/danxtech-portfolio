import { io, type Socket } from "socket.io-client";
import { API_ORIGIN, SOCKET_ORIGIN } from "../app/config";

export type ConnectionStatus =
  | "offline"
  | "connecting"
  | "live"
  | "reconnecting"
  | "degraded";

type Handler = (payload: unknown) => void;

let socket: Socket | null = null;
let status: ConnectionStatus = "offline";
const handlers = new Map<string, Set<Handler>>();
const statusHandlers = new Set<(status: ConnectionStatus) => void>();
const authHandlers = new Set<() => void>();
const revokedHandlers = new Set<() => void>();

const setStatus = (next: ConnectionStatus): void => {
  status = next;
  for (const handler of statusHandlers) handler(next);
};

const emitLocal = (event: string, payload: unknown): void => {
  for (const handler of handlers.get(event) ?? []) handler(payload);
};

/**
 * Subscribe to a server event without owning the socket. Returns an unsubscribe
 * function so RTK Query cache entries can clean up on removal.
 */
export const onRealtime = (event: string, handler: Handler): (() => void) => {
  const set = handlers.get(event) ?? new Set<Handler>();
  set.add(handler);
  handlers.set(event, set);
  return () => {
    set.delete(handler);
    if (set.size === 0) handlers.delete(event);
  };
};

export const onStatus = (handler: (next: ConnectionStatus) => void): (() => void) => {
  statusHandlers.add(handler);
  handler(status);
  return () => statusHandlers.delete(handler);
};

export const onAuthExpired = (handler: () => void): (() => void) => {
  authHandlers.add(handler);
  return () => authHandlers.delete(handler);
};

export const onSessionRevoked = (handler: () => void): (() => void) => {
  revokedHandlers.add(handler);
  return () => revokedHandlers.delete(handler);
};

export const connectionStatus = (): ConnectionStatus => status;
export const isLive = (): boolean => status === "live" && Boolean(socket?.connected);

export const connectRealtime = (): void => {
  if (socket) {
    if (!socket.connected) socket.connect();
    return;
  }

  setStatus("connecting");
  const next = io(`${SOCKET_ORIGIN}/admin`, {
    withCredentials: true,
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5_000,
    // Static hosts cannot proxy WebSockets, so a same-origin deployment uses
    // long-polling and falls back to REST polling if that also fails.
    transports: API_ORIGIN ? ["websocket", "polling"] : ["polling"],
  });
  socket = next;

  next.on("connect", () => {
    setStatus("live");
    emitLocal("__connected", {});
  });

  next.on("disconnect", (reason) => {
    if (reason === "io client disconnect") {
      setStatus("offline");
      return;
    }
    setStatus("reconnecting");
  });

  next.on("connect_error", (error) => {
    if (error.message === "AUTH_EXPIRED" || error.message === "AUTH_REQUIRED") {
      setStatus("degraded");
      for (const handler of authHandlers) handler();
      return;
    }
    setStatus("reconnecting");
  });

  next.io.on("reconnect_attempt", () => setStatus("reconnecting"));
  next.io.on("reconnect_failed", () => setStatus("degraded"));
  next.io.on("error", () => setStatus("degraded"));

  for (const event of [
    "conversation:new",
    "conversation:update",
    "message:new",
    "message:status",
    "typing",
    "presence",
    "session:revoked",
  ]) {
    next.on(event, (payload: unknown) => {
      if (event === "session:revoked") {
        for (const handler of revokedHandlers) handler();
      }
      emitLocal(event, payload);
    });
  }

  next.connect();
};

export const disconnectRealtime = (): void => {
  socket?.disconnect();
  socket = null;
  setStatus("offline");
};

export const joinConversation = (conversationId: string): void => {
  socket?.emit("conversation:view", { conversationId });
};

export const leaveConversation = (conversationId: string): void => {
  socket?.emit("conversation:leave", { conversationId });
};

export const emitSeen = (conversationId: string, upToSeq: number): void => {
  socket?.emit("seen", { conversationId, upToSeq });
};

export const emitTyping = (
  conversationId: string,
  isTyping: boolean,
): void => {
  socket?.emit("typing", { conversationId, isTyping });
};

export type SendResult =
  | { ok: true; message: unknown }
  | { ok: false; error?: { code: string; message: string } };

/** Send with an ack and an 8-second timeout, so the UI can offer Retry. */
export const emitMessage = (
  conversationId: string,
  clientMsgId: string,
  body: string,
): Promise<SendResult> =>
  new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({
        ok: false,
        error: { code: "OFFLINE", message: "Realtime connection is offline." },
      });
      return;
    }

    const timer = setTimeout(() => {
      resolve({
        ok: false,
        error: { code: "TIMEOUT", message: "Message timed out. Retry?" },
      });
    }, 8_000);

    socket.emit(
      "message:send",
      { conversationId, clientMsgId, body },
      (result: SendResult) => {
        clearTimeout(timer);
        resolve(result);
      },
    );
  });

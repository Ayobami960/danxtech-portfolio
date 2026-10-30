import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import type { Request } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import {
  ACCESS_COOKIE,
  CHAT_SESSION_COOKIE,
  REFRESH_COOKIE,
} from "../config/constants.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { hashRefreshToken } from "../lib/crypto.js";
import { findAdminById } from "../repositories/admin.repository.js";
import { findRefreshTokenByHash } from "../repositories/refresh-token.repository.js";
import { activeFamilyExists } from "../repositories/account.repository.js";
import type { AdminUser } from "../database/schema.js";
import {
  adminSendMessage,
  guestSendMessage,
  markSeen,
  guestPresence,
  verifyGuestSession,
} from "../services/chat.service.js";
import { setChatRealtime, type ChatRealtime } from "./bus.js";
import {
  chatAttachmentMimeSchema,
  chatAttachmentNameSchema,
  chatImageKeySchema,
  normalizeMessageBody,
} from "../schemas/chat.schemas.js";

const conversationIdSchema = z.uuid();

const messagePayload = z
  .object({
    conversationId: conversationIdSchema.optional(),
    clientMsgId: z.uuid(),
    body: z.string().max(2000),
    imageKey: chatImageKeySchema.optional(),
    imageMimeType: chatAttachmentMimeSchema.optional(),
    attachmentName: chatAttachmentNameSchema.optional(),
  })
  .strict();

const typingPayload = z
  .object({
    conversationId: conversationIdSchema.optional(),
    isTyping: z.boolean(),
  })
  .strict();

const seenPayload = z
  .object({
    conversationId: conversationIdSchema.optional(),
    upToSeq: z.coerce.number().int().min(0),
  })
  .strict();

const viewPayload = z.object({ conversationId: conversationIdSchema }).strict();

type Ack = (response: {
  ok: boolean;
  message?: unknown;
  error?: { code: string; message: string };
}) => void;

type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();

/** Simple per-socket token bucket: burst of `capacity`, refilled per minute. */
const allow = (
  socket: Socket,
  kind: "message" | "typing",
  capacity: number,
): boolean => {
  const now = Date.now();
  const key = `${socket.id}:${kind}`;
  const current = buckets.get(key) ?? { tokens: capacity, updatedAt: now };
  const elapsed = now - current.updatedAt;
  const perMinute = capacity;
  const refilled = Math.min(capacity, current.tokens + (elapsed / 60_000) * perMinute);
  if (refilled < 1) {
    buckets.set(key, { tokens: refilled, updatedAt: now });
    return false;
  }
  buckets.set(key, { tokens: refilled - 1, updatedAt: now });
  return true;
};

const parseCookies = (header: string | undefined): Record<string, string> => {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) {
      try {
        result[name] = decodeURIComponent(value);
      } catch {
        result[name] = value;
      }
    }
  }
  return result;
};

const socketRequest = (socket: Socket, admin: AdminUser): Request =>
  ({
    id: socket.id,
    ip: socket.handshake.address,
    admin,
    get: (name: string) =>
      socket.handshake.headers[name.toLowerCase()] as string | undefined,
  }) as unknown as Request;

const allowedOrigin = (origin: string | undefined): boolean => {
  if (!origin) return true;
  if (env.frontendOrigins.length === 0) {
    return /^http:\/\/localhost(:\d+)?$/.test(origin);
  }
  return env.frontendOrigins.includes(origin);
};

export const attachChatGateway = (httpServer: HttpServer): Server => {
  const io = new Server(httpServer, {
    path: "/socket.io",
    serveClient: false,
    maxHttpBufferSize: 100 * 1024,
    cors: {
      origin: (origin, callback) => callback(null, allowedOrigin(origin)),
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  const adminNs = io.of("/admin");
  const chatNs = io.of("/chat");

  const adminSockets = new Set<string>();
  const visitorSockets = new Map<string, Set<string>>();
  const adminViewing = new Map<string, Set<string>>();
  const typingTimers = new Map<string, NodeJS.Timeout>();

  /** Typing indicators expire on their own after four seconds of silence. */
  const scheduleTypingOff = (
    key: string,
    conversationId: string,
    from: "visitor" | "admin",
  ): void => {
    const existing = typingTimers.get(key);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      typingTimers.delete(key);
      adminNs.to(`conv:${conversationId}`).emit("typing", {
        conversationId,
        from,
        isTyping: false,
      });
      chatNs.to(`conv:${conversationId}`).emit("typing", {
        conversationId,
        from,
        isTyping: false,
      });
    }, 4_000);
    timer.unref();
    typingTimers.set(key, timer);
  };

  const presence = (conversationId: string) => ({
    conversationId,
    visitorOnline: (visitorSockets.get(conversationId)?.size ?? 0) > 0,
    adminOnline: adminSockets.size > 0,
    adminViewing: (adminViewing.get(conversationId)?.size ?? 0) > 0,
  });

  const emitPresence = (conversationId: string): void => {
    const payload = presence(conversationId);
    adminNs.to(`conv:${conversationId}`).emit("presence", payload);
    chatNs.to(`conv:${conversationId}`).emit("presence", payload);
  };

  const impl: ChatRealtime = {
    toAdmins: (event, payload) => {
      adminNs.to("admins").emit(event, payload);
    },
    toConversation: (conversationId, event, payload) => {
      adminNs.to(`conv:${conversationId}`).emit(event, payload);
      chatNs.to(`conv:${conversationId}`).emit(event, payload);
    },
    toGuests: (conversationId, event, payload) => {
      chatNs.to(`conv:${conversationId}`).emit(event, payload);
    },
    isAdminOnline: () => adminSockets.size > 0,
    isAdminViewing: (conversationId) => (adminViewing.get(conversationId)?.size ?? 0) > 0,
    isVisitorOnline: (conversationId) => (visitorSockets.get(conversationId)?.size ?? 0) > 0,
    presenceFor: presence,
    closeGuests: (conversationId, reason) => {
      chatNs.to(`conv:${conversationId}`).emit(reason, {});
      chatNs.in(`conv:${conversationId}`).disconnectSockets(true);
    },
    disconnectSessionFamily: (familyId) => {
      for (const socket of adminNs.sockets.values()) {
        if (socket.data.familyId === familyId) {
          socket.emit("session:revoked", {});
          socket.disconnect(true);
        }
      }
    },
  };
  setChatRealtime(impl);

  /* ------------------------------- admin namespace ------------------------------- */

  adminNs.use((socket, next) => {
    void (async () => {
      try {
        const origin = socket.handshake.headers.origin;
        if (!allowedOrigin(origin)) {
          next(new Error("ORIGIN_REJECTED"));
          return;
        }
        const cookies = parseCookies(socket.handshake.headers.cookie);
        const token = cookies[ACCESS_COOKIE];
        if (!token) {
          next(new Error("AUTH_REQUIRED"));
          return;
        }
        const payload = await verifyAccessToken(token);
        const admin = await findAdminById(payload.sub);
        if (!admin) {
          next(new Error("AUTH_REQUIRED"));
          return;
        }
        let familyId: string | null = null;
        const refresh = cookies[REFRESH_COOKIE];
        if (refresh) {
          const row = await findRefreshTokenByHash(hashRefreshToken(refresh));
          familyId = row?.familyId ?? null;
        }
        socket.data.adminId = admin.id;
        socket.data.familyId = familyId;
        socket.data.userAgent = admin.email;
        next();
      } catch {
        next(new Error("AUTH_EXPIRED"));
      }
    })();
  });

  adminNs.on("connection", (socket) => {
    adminSockets.add(socket.id);
    void socket.join("admins");

    socket.on("conversation:view", (raw) => {
      const parsed = viewPayload.safeParse(raw);
      if (!parsed.success) return;
      const { conversationId } = parsed.data;
      void socket.join(`conv:${conversationId}`);
      const viewers = adminViewing.get(conversationId) ?? new Set<string>();
      viewers.add(socket.id);
      adminViewing.set(conversationId, viewers);
      emitPresence(conversationId);
    });

    socket.on("conversation:leave", (raw) => {
      const parsed = viewPayload.safeParse(raw);
      if (!parsed.success) return;
      const { conversationId } = parsed.data;
      void socket.leave(`conv:${conversationId}`);
      const viewers = adminViewing.get(conversationId);
      viewers?.delete(socket.id);
      if (viewers && viewers.size === 0) adminViewing.delete(conversationId);
      emitPresence(conversationId);
    });

    socket.on("message:send", (raw, ack?: Ack) => {
      void (async () => {
        if (!allow(socket, "message", 60)) {
          ack?.({
            ok: false,
            error: { code: "RATE_LIMITED", message: "Slow down a little." },
          });
          return;
        }
        const parsed = messagePayload.safeParse(raw);
        if (!parsed.success || !parsed.data.conversationId) {
          ack?.({
            ok: false,
            error: { code: "VALIDATION_ERROR", message: "Invalid message payload." },
          });
          return;
        }
        const admin = await findAdminById(socket.data.adminId as string);
        if (!admin) {
          ack?.({
            ok: false,
            error: { code: "UNAUTHORIZED", message: "Session expired." },
          });
          return;
        }
        try {
          const message = await adminSendMessage(
            socketRequest(socket, admin),
            parsed.data.conversationId,
            {
              clientMsgId: parsed.data.clientMsgId,
              body: normalizeMessageBody(parsed.data.body),
              ...(parsed.data.imageKey ? { imageKey: parsed.data.imageKey } : {}),
              ...(parsed.data.imageMimeType
                ? { imageMimeType: parsed.data.imageMimeType }
                : {}),
              ...(parsed.data.attachmentName
                ? { attachmentName: parsed.data.attachmentName }
                : {}),
            },
          );
          ack?.({ ok: true, message });
        } catch (error) {
          ack?.({
            ok: false,
            error: {
              code: "SEND_FAILED",
              message: error instanceof Error ? error.message : "Message failed.",
            },
          });
        }
      })();
    });

    socket.on("typing", (raw) => {
      if (!allow(socket, "typing", 60)) return;
      const parsed = typingPayload.safeParse(raw);
      if (!parsed.success || !parsed.data.conversationId) return;
      const { conversationId, isTyping } = parsed.data;
      chatNs.to(`conv:${conversationId}`).emit("typing", {
        conversationId,
        from: "admin",
        isTyping,
      });
      if (isTyping) {
        scheduleTypingOff(`${socket.id}:typing`, conversationId, "admin");
      }
    });

    socket.on("seen", (raw) => {
      const parsed = seenPayload.safeParse(raw);
      if (!parsed.success || !parsed.data.conversationId) return;
      void markSeen(parsed.data.conversationId, "admin", parsed.data.upToSeq).catch(
        (error: unknown) => {
          logger.warn({ err: error }, "Failed to mark conversation seen");
        },
      );
    });

    socket.on("disconnect", () => {
      adminSockets.delete(socket.id);
      for (const [conversationId, viewers] of adminViewing) {
        if (viewers.delete(socket.id)) {
          if (viewers.size === 0) adminViewing.delete(conversationId);
          emitPresence(conversationId);
        }
      }
    });
  });

  /* ------------------------------- guest namespace ------------------------------- */

  chatNs.use((socket, next) => {
    void (async () => {
      try {
        const origin = socket.handshake.headers.origin;
        if (!allowedOrigin(origin)) {
          next(new Error("ORIGIN_REJECTED"));
          return;
        }
        // The SPA sends the session in the handshake; a same-site deployment
        // can rely on the httpOnly cookie instead.
        const authToken =
          typeof socket.handshake.auth?.token === "string"
            ? socket.handshake.auth.token
            : undefined;
        const cookies = parseCookies(socket.handshake.headers.cookie);
        const token = authToken ?? cookies[CHAT_SESSION_COOKIE];
        if (!token) {
          next(new Error("INVITE_INVALID"));
          return;
        }
        const conversationId = await verifyGuestSession(token);
        socket.data.conversationId = conversationId;
        next();
      } catch {
        next(new Error("INVITE_INVALID"));
      }
    })();
  });

  chatNs.on("connection", (socket) => {
    const conversationId = socket.data.conversationId as string;
    void socket.join(`conv:${conversationId}`);
    const guests = visitorSockets.get(conversationId) ?? new Set<string>();
    guests.add(socket.id);
    visitorSockets.set(conversationId, guests);
    emitPresence(conversationId);

    socket.on("message:send", (raw, ack?: Ack) => {
      void (async () => {
        if (!allow(socket, "message", 20)) {
          ack?.({
            ok: false,
            error: {
              code: "RATE_LIMITED",
              message: "You're sending messages too quickly.",
            },
          });
          return;
        }
        const parsed = messagePayload.safeParse(raw);
        if (!parsed.success) {
          ack?.({
            ok: false,
            error: { code: "VALIDATION_ERROR", message: "Invalid message payload." },
          });
          return;
        }
        try {
          const message = await guestSendMessage(conversationId, {
            clientMsgId: parsed.data.clientMsgId,
            body: normalizeMessageBody(parsed.data.body),
            ...(parsed.data.imageKey ? { imageKey: parsed.data.imageKey } : {}),
            ...(parsed.data.imageMimeType
              ? { imageMimeType: parsed.data.imageMimeType }
              : {}),
            ...(parsed.data.attachmentName
              ? { attachmentName: parsed.data.attachmentName }
              : {}),
          });
          ack?.({ ok: true, message });
        } catch (error) {
          ack?.({
            ok: false,
            error: {
              code: "SEND_FAILED",
              message: error instanceof Error ? error.message : "Message failed.",
            },
          });
        }
      })();
    });

    socket.on("typing", (raw) => {
      if (!allow(socket, "typing", 30)) return;
      const parsed = typingPayload.safeParse(raw);
      if (!parsed.success) return;
      adminNs.to(`conv:${conversationId}`).emit("typing", {
        conversationId,
        from: "visitor",
        isTyping: parsed.data.isTyping,
      });
      if (parsed.data.isTyping) {
        scheduleTypingOff(`${socket.id}:typing`, conversationId, "visitor");
      }
    });

    socket.on("seen", (raw) => {
      const parsed = seenPayload.safeParse(raw);
      if (!parsed.success) return;
      void markSeen(conversationId, "visitor", parsed.data.upToSeq).catch(
        (error: unknown) => {
          logger.warn({ err: error }, "Failed to mark guest message seen");
        },
      );
    });

    socket.on("disconnect", () => {
      const set = visitorSockets.get(conversationId);
      set?.delete(socket.id);
      if (set && set.size === 0) visitorSockets.delete(conversationId);
      emitPresence(conversationId);
      void guestPresence(conversationId).catch(() => undefined);
    });
  });

  /* ------------------------------ session revalidation ----------------------------- */

  const interval = setInterval(() => {
    void (async () => {
      for (const socket of adminNs.sockets.values()) {
        const userId = socket.data.adminId as string | undefined;
        const familyId = socket.data.familyId as string | null | undefined;
        if (!userId) continue;
        if (!familyId) {
          socket.disconnect(true);
          continue;
        }
        try {
          if (!(await activeFamilyExists(userId, familyId))) {
            socket.emit("session:revoked", {});
            socket.disconnect(true);
          }
        } catch (error) {
          logger.warn({ err: error }, "Session revalidation failed");
        }
      }
    })();
  }, 60_000);
  interval.unref();

  io.on("connection", (socket) => {
    // Unused root namespace: close immediately so it cannot be used accidentally.
    socket.disconnect(true);
  });

  logger.info("Socket.IO chat gateway attached");

  // Keep the singleton in sync for graceful shutdown.
  gateway = io;
  return io;
};

let gateway: Server | null = null;

export const closeChatGateway = async (): Promise<void> => {
  if (!gateway) return;
  await gateway.close();
  gateway = null;
};


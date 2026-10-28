import { eq, inArray } from "drizzle-orm";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { redis } from "../../config/redis.js";
import { env } from "../../config/env.js";
import { db } from "../../database/clients.js";
import { conversation_participants } from "../../database/schema.js";
import { authenticateAccessToken } from "../auth/auth.service.js";
import { getAgencyIdForMember } from "../agency/agency.service.js";
import { markConversationRead, requireMember } from "./messaging.service.js";
import { actorRoomId, emitConversationUpdate, getConversationRecipients, isAgencyConversationParticipant, markAgencyConversationRead, scopeRoom, setMessagingServer, } from "./messaging.events.js";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPING_WINDOW_MS = 1_000;
const TYPING_MAX_PER_WINDOW = 5;
let io;
let adapterClients = [];
/**
 * `${roomId} -> socket ids`, where roomId is the account id (default scope)
 * or the agency id (agency scope). Presence is online while it has any socket.
 */
const userSockets = new Map();
/** `${socket.id} -> conversation ids this socket is currently typing in`. */
const typingConversations = new Map();
const isRecord = (value) => typeof value === "object" && value !== null;
const isUuid = (value) => typeof value === "string" && UUID_RE.test(value);
const getActor = (socket) => ({
    userId: socket.data.userId,
    scope: socket.data.scope,
    agencyId: socket.data.agencyId,
});
/** Redis adapter so multiple API instances share rooms/presence. Optional. */
const attachRedisAdapter = async (server) => {
    if (!redis.isOpen) {
        console.info("Socket.io is running single-instance (Redis is not connected).");
        return;
    }
    const pubClient = redis.duplicate();
    const subClient = redis.duplicate();
    try {
        await Promise.all([pubClient.connect(), subClient.connect()]);
        server.adapter(createAdapter(pubClient, subClient));
        adapterClients = [pubClient, subClient];
        console.info("Socket.io Redis adapter enabled.");
    }
    catch (error) {
        // Never leave a half-open duplicate client behind for the process lifetime.
        await Promise.allSettled([pubClient.quit(), subClient.quit()]);
        console.warn("Socket.io Redis adapter could not start; continuing single-instance.", error);
    }
};
/**
 * Everyone who shares a conversation with this actor, expressed as the room
 * they listen in: clients and freelancers listen in "default" under their
 * account id, the agency side listens in "agency" under the agency id.
 * Presence is only ever sent to and received from these peers.
 */
const getPresencePeers = async (actor) => {
    const memberships = await db
        .select({ conversationId: conversation_participants.conversation_id })
        .from(conversation_participants)
        .where(actor.agencyId
        ? eq(conversation_participants.agency_id, actor.agencyId)
        : eq(conversation_participants.account_id, actor.userId));
    const conversationIds = memberships.map(({ conversationId }) => conversationId);
    if (!conversationIds.length)
        return [];
    const rows = await db
        .select({
        accountId: conversation_participants.account_id,
        agencyId: conversation_participants.agency_id,
        participantType: conversation_participants.participant_type,
    })
        .from(conversation_participants)
        .where(inArray(conversation_participants.conversation_id, conversationIds));
    const peers = new Map();
    for (const row of rows) {
        const isAgency = row.participantType === "AGENCY";
        const id = isAgency ? row.agencyId : row.accountId;
        if (!id)
            continue;
        const isSelf = isAgency ? id === actor.agencyId : id === actor.userId;
        if (isSelf)
            continue;
        const scope = isAgency ? "agency" : "default";
        peers.set(`${scope}:${id}`, { id, scope });
    }
    return [...peers.values()];
};
const emitPresenceToPeers = (server, peers, payload) => {
    peers.forEach(({ id, scope }) => server.to(scopeRoom(id, scope)).emit("presence:update", payload));
};
const notifyTyping = async (server, conversationId, actor, isTyping) => {
    const selfId = actorRoomId(actor);
    const recipients = await getConversationRecipients(conversationId);
    recipients
        .filter(({ id, scope }) => !(id === selfId && scope === actor.scope))
        .forEach(({ id, scope }) => server.to(scopeRoom(id, scope)).emit("typing:update", {
        conversationId,
        userId: selfId,
        isTyping,
    }));
};
/** The actor must be a participant before anything is relayed or changed. */
const isParticipant = async (conversationId, actor) => {
    if (actor.agencyId) {
        return isAgencyConversationParticipant(conversationId, actor.agencyId);
    }
    try {
        await requireMember(conversationId, actor.userId);
        return true;
    }
    catch {
        return false;
    }
};
const onTypingSet = async (server, socket, payload) => {
    if (!isRecord(payload) || !isUuid(payload.conversationId))
        return;
    if (typeof payload.isTyping !== "boolean")
        return;
    // Per-socket throttle: a typing indicator never needs more than a few
    // events per second, and this keeps a misbehaving client from flooding the
    // other participant's sockets.
    const now = Date.now();
    const hits = socket.data.typingHits.filter((timestamp) => now - timestamp < TYPING_WINDOW_MS);
    if (hits.length >= TYPING_MAX_PER_WINDOW) {
        socket.data.typingHits = hits;
        return;
    }
    hits.push(now);
    socket.data.typingHits = hits;
    const { conversationId, isTyping } = payload;
    const actor = getActor(socket);
    // Never trust a conversation id from the client.
    if (!(await isParticipant(conversationId, actor)))
        return;
    const typing = typingConversations.get(socket.id) ?? new Set();
    if (isTyping)
        typing.add(conversationId);
    else
        typing.delete(conversationId);
    if (typing.size)
        typingConversations.set(socket.id, typing);
    else
        typingConversations.delete(socket.id);
    await notifyTyping(server, conversationId, actor, isTyping);
};
const onConversationRead = async (socket, payload, acknowledge) => {
    if (!isRecord(payload) ||
        !isUuid(payload.conversationId) ||
        !isUuid(payload.messageId)) {
        acknowledge?.({ success: false });
        return;
    }
    const { agencyId, userId } = socket.data;
    try {
        if (agencyId) {
            // Shared agency participant row, not any one member's account row.
            const updated = await markAgencyConversationRead(payload.conversationId, agencyId, payload.messageId);
            if (!updated) {
                acknowledge?.({ success: false });
                return;
            }
        }
        else {
            await markConversationRead(payload.conversationId, userId, payload.messageId);
        }
    }
    catch {
        acknowledge?.({ success: false });
        return;
    }
    acknowledge?.({ success: true });
    // Read state changed, but no message was added: the inbox refresh path.
    await emitConversationUpdate(payload.conversationId, {
        messagesChanged: false,
        senderId: null,
    }).catch((error) => {
        console.error("Failed to emit conversation read update.", error);
    });
};
const handleConnection = (server, socket) => {
    const actor = getActor(socket);
    // An agency conversation has one shared participant row tagged with the
    // agency id, so every team member connecting with scope "agency" joins the
    // same room and presence is keyed by the agency, not the member.
    const selfRoomId = actorRoomId(actor);
    socket.join(scopeRoom(selfRoomId, actor.scope));
    const sockets = userSockets.get(selfRoomId) ?? new Set();
    const cameOnline = sockets.size === 0;
    sockets.add(socket.id);
    userSockets.set(selfRoomId, sockets);
    // Peers found at connect time; used as a fallback if the disconnect-time
    // lookup fails.
    let peers = [];
    // Presence is limited to people who share a conversation with this actor,
    // instead of every connected socket. Event handlers are registered below
    // without waiting for this lookup, so early events are never missed.
    void (async () => {
        peers = await getPresencePeers(actor);
        const partnerIds = [...new Set(peers.map((peer) => peer.id))];
        socket.emit("presence:snapshot", {
            userIds: partnerIds.filter((id) => userSockets.has(id)),
        });
        if (cameOnline) {
            emitPresenceToPeers(server, peers, {
                userId: selfRoomId,
                online: true,
            });
        }
    })().catch((error) => {
        console.error("Failed to send presence state.", error);
        socket.emit("presence:snapshot", { userIds: [] });
    });
    socket.on("typing:set", (payload) => {
        void onTypingSet(server, socket, payload).catch((error) => {
            console.error("Failed to relay typing state.", error);
        });
    });
    socket.on("conversation:read", (payload, acknowledge) => {
        void onConversationRead(socket, payload, acknowledge).catch((error) => {
            console.error("Failed to mark a conversation read over the socket.", error);
        });
    });
    socket.on("disconnect", () => {
        const typing = typingConversations.get(socket.id);
        if (typing) {
            typingConversations.delete(socket.id);
            typing.forEach((conversationId) => {
                void notifyTyping(server, conversationId, actor, false).catch(() => undefined);
            });
        }
        const activeSockets = userSockets.get(selfRoomId);
        activeSockets?.delete(socket.id);
        if (activeSockets?.size)
            return;
        userSockets.delete(selfRoomId);
        const payload = {
            userId: selfRoomId,
            online: false,
            lastActiveAt: new Date().toISOString(),
        };
        // Re-query so conversations created during this session are covered;
        // fall back to the peers found at connect time if the query fails.
        void getPresencePeers(actor)
            .catch(() => peers)
            .then((latest) => emitPresenceToPeers(server, latest, payload))
            .catch((error) => {
            console.error("Failed to broadcast offline presence.", error);
        });
    });
};
/**
 * Creates the single Socket.io server shared by both dashboards. Call it once,
 * after the HTTP server exists. The Redis adapter is used when Redis is
 * connected, so this is safe to run behind multiple API instances.
 */
export const initializeMessagingSocket = async (httpServer) => {
    if (io)
        return;
    const server = new Server(httpServer, {
        cors: {
            origin: env.socketOrigins,
            credentials: true,
        },
    });
    await attachRedisAdapter(server);
    server.use(async (socket, next) => {
        const auth = socket.handshake.auth;
        const token = auth.token;
        const requestedRole = auth.role;
        const scope = auth.scope === "agency" ? "agency" : "default";
        if (typeof token !== "string" || !token.trim()) {
            next(new Error("Authentication is required."));
            return;
        }
        if (requestedRole !== "client" && requestedRole !== "freelancer") {
            next(new Error("Role is invalid."));
            return;
        }
        try {
            const account = await authenticateAccessToken(token);
            // The token already carries the account role; a mismatched handshake
            // role is a client bug or an attempt to listen as the other side.
            if (account.role !== requestedRole) {
                next(new Error("Role does not match this account."));
                return;
            }
            // The agency id is always resolved from server-side membership, never
            // from the handshake, so a client cannot listen as someone else's agency.
            let agencyId = null;
            if (scope === "agency") {
                if (account.role !== "freelancer") {
                    next(new Error("Agency messaging requires a freelancer account."));
                    return;
                }
                agencyId = await getAgencyIdForMember(account.userId);
                if (!agencyId) {
                    next(new Error("You are not a member of an agency."));
                    return;
                }
            }
            socket.data.userId = account.userId;
            socket.data.role = account.role;
            socket.data.scope = scope;
            socket.data.agencyId = agencyId;
            socket.data.typingHits = [];
            next();
        }
        catch (error) {
            // Reject as an Error so the browser's connect_error flow can refresh
            // the access token once and reconnect.
            next(new Error(error instanceof Error ? error.message : "Authentication failed."));
        }
    });
    server.on("connection", (socket) => handleConnection(server, socket));
    io = server;
    setMessagingServer(server);
};
/** Disconnects every socket and releases the optional Redis adapter clients. */
export const shutdownMessagingSocket = async () => {
    if (io) {
        await io.close();
        io = undefined;
    }
    // Socket.io does not clear our own bookkeeping; without this the maps keep
    // every socket id and typing entry alive after the server is closed.
    userSockets.clear();
    typingConversations.clear();
    const clients = adapterClients;
    adapterClients = [];
    await Promise.allSettled(clients.map((client) => client.quit()));
};
//# sourceMappingURL=messaging.socket.js.map
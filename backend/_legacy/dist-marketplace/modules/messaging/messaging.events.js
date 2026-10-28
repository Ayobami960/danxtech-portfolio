import { and, eq, sql } from "drizzle-orm";
import { db } from "../../database/clients.js";
import { conversation_participants, messages, } from "../../database/schema.js";
/**
 * Shared Socket.io state for messaging. The server is created once in
 * `initializeMessagingSocket`; the REST layer only ever publishes through the
 * helpers below, which keeps the database transaction out of the socket code.
 */
let io;
export const setMessagingServer = (server) => {
    io = server;
};
export const getMessagingServer = () => io;
/**
 * Default rooms keep the original `user:${id}` name so existing emitters keep
 * working; agency rooms are keyed by agency id.
 */
export const scopeRoom = (id, scope) => scope === "agency" ? `user:${id}:agency` : `user:${id}`;
/** The id this actor is known by to everyone else (agency id for agencies). */
export const actorRoomId = (actor) => actor.agencyId ?? actor.userId;
/** Account ids of everyone in a conversation (never exposed to other users). */
export const getConversationParticipantIds = async (conversationId) => {
    const rows = await db
        .select({ accountId: conversation_participants.account_id })
        .from(conversation_participants)
        .where(eq(conversation_participants.conversation_id, conversationId));
    return [
        ...new Set(rows
            .map(({ accountId }) => accountId)
            .filter((accountId) => Boolean(accountId))),
    ];
};
/**
 * Every room owner in a conversation, agency-aware: an AGENCY participant is
 * addressed by its agency id in the "agency" scope, everyone else by account
 * id in the "default" scope.
 */
export const getConversationRecipients = async (conversationId) => {
    const rows = await db
        .select({
        accountId: conversation_participants.account_id,
        agencyId: conversation_participants.agency_id,
        participantType: conversation_participants.participant_type,
    })
        .from(conversation_participants)
        .where(eq(conversation_participants.conversation_id, conversationId));
    const recipients = new Map();
    rows.forEach(({ accountId, agencyId, participantType }) => {
        const isAgency = participantType === "AGENCY";
        const id = isAgency ? agencyId : accountId;
        if (!id)
            return;
        const scope = isAgency ? "agency" : "default";
        recipients.set(`${scope}:${id}`, { id, scope });
    });
    return [...recipients.values()];
};
/** Agency-side membership check (the default side uses `requireMember`). */
export const isAgencyConversationParticipant = async (conversationId, agencyId) => {
    const [row] = await db
        .select({ id: conversation_participants.id })
        .from(conversation_participants)
        .where(and(eq(conversation_participants.conversation_id, conversationId), eq(conversation_participants.agency_id, agencyId)))
        .limit(1);
    return Boolean(row);
};
/**
 * Agency-side read receipt: updates the shared agency participant row, and
 * only when the message really belongs to that conversation.
 */
export const markAgencyConversationRead = async (conversationId, agencyId, messageId) => {
    const [participant] = await db
        .update(conversation_participants)
        .set({
        last_read_message_id: messageId,
        last_read_at: new Date(),
        unread_count: 0,
    })
        .where(and(eq(conversation_participants.conversation_id, conversationId), eq(conversation_participants.agency_id, agencyId), sql `EXISTS (
          SELECT 1 FROM ${messages}
          WHERE ${messages.id} = ${messageId}
            AND ${messages.conversation_id} = ${conversationId}
        )`))
        .returning({ id: conversation_participants.id });
    return Boolean(participant);
};
/**
 * Tells every participant (including the sender's other tabs) that a thread
 * changed. Call it only after the database transaction has committed.
 */
export const emitConversationUpdate = async (conversationId, options) => {
    if (!io)
        return;
    const recipients = await getConversationRecipients(conversationId);
    const payload = {
        conversationId,
        messagesChanged: options.messagesChanged,
        senderId: options.senderId ?? null,
    };
    recipients.forEach(({ id, scope }) => {
        io?.to(scopeRoom(id, scope)).emit("conversation:update", payload);
    });
};
//# sourceMappingURL=messaging.events.js.map
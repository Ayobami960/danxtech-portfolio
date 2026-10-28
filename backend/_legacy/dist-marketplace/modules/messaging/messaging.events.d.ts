import type { Server } from "socket.io";
export declare const setMessagingServer: (server: Server) => void;
export declare const getMessagingServer: () => Server | undefined;
/**
 * "default" = a client or a freelancer's personal dashboard (rows keyed by
 * account id). "agency" = the agency workspace: one shared participant row
 * keyed by the agency id, so the whole team listens in the same room.
 */
export type ConversationScope = "default" | "agency";
export interface MessagingActor {
    userId: string;
    scope: ConversationScope;
    /** Set only for scope "agency". */
    agencyId: string | null;
}
export interface ConversationRecipient {
    id: string;
    scope: ConversationScope;
}
/**
 * Default rooms keep the original `user:${id}` name so existing emitters keep
 * working; agency rooms are keyed by agency id.
 */
export declare const scopeRoom: (id: string, scope: ConversationScope) => string;
/** The id this actor is known by to everyone else (agency id for agencies). */
export declare const actorRoomId: (actor: MessagingActor) => string;
/** Account ids of everyone in a conversation (never exposed to other users). */
export declare const getConversationParticipantIds: (conversationId: string) => Promise<string[]>;
/**
 * Every room owner in a conversation, agency-aware: an AGENCY participant is
 * addressed by its agency id in the "agency" scope, everyone else by account
 * id in the "default" scope.
 */
export declare const getConversationRecipients: (conversationId: string) => Promise<ConversationRecipient[]>;
/** Agency-side membership check (the default side uses `requireMember`). */
export declare const isAgencyConversationParticipant: (conversationId: string, agencyId: string) => Promise<boolean>;
/**
 * Agency-side read receipt: updates the shared agency participant row, and
 * only when the message really belongs to that conversation.
 */
export declare const markAgencyConversationRead: (conversationId: string, agencyId: string, messageId: string) => Promise<boolean>;
/**
 * Tells every participant (including the sender's other tabs) that a thread
 * changed. Call it only after the database transaction has committed.
 */
export declare const emitConversationUpdate: (conversationId: string, options: {
    messagesChanged: boolean;
    senderId?: string | null | undefined;
}) => Promise<void>;

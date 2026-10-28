import type { ChatMessage, Conversation } from "../database/schema.js";
import { publicMediaUrl } from "../storage/index.js";

export type AdminConversationEvent = {
  conversation: ReturnType<typeof toConversationEvent>;
};

export type TypingEvent = {
  conversationId: string;
  from: "visitor" | "admin";
  isTyping: boolean;
};

export type PresenceEvent = {
  conversationId: string;
  visitorOnline: boolean;
  adminOnline: boolean;
  adminViewing: boolean;
};

export type ChatRealtime = {
  toAdmins: (event: string, payload: unknown) => void;
  toConversation: (conversationId: string, event: string, payload: unknown) => void;
  toGuests: (conversationId: string, event: string, payload: unknown) => void;
  isAdminOnline: () => boolean;
  isAdminViewing: (conversationId: string) => boolean;
  isVisitorOnline: (conversationId: string) => boolean;
  presenceFor: (conversationId: string) => PresenceEvent;
  closeGuests: (conversationId: string, reason: "chat:closed" | "invite:revoked") => void;
  disconnectSessionFamily: (familyId: string) => void;
};

const noop = (): void => undefined;

const fallback: ChatRealtime = {
  toAdmins: noop,
  toConversation: noop,
  toGuests: noop,
  isAdminOnline: () => false,
  isAdminViewing: () => false,
  isVisitorOnline: () => false,
  presenceFor: (conversationId) => ({
    conversationId,
    visitorOnline: false,
    adminOnline: false,
    adminViewing: false,
  }),
  closeGuests: noop,
  disconnectSessionFamily: noop,
};

let implementation: ChatRealtime = fallback;

export const setChatRealtime = (next: ChatRealtime): void => {
  implementation = next;
};

export const realtime = (): ChatRealtime => implementation;

/** Shared JSON shape for admin conversation events (never the invite hash). */
export const toConversationEvent = (
  conversation: Conversation,
): Record<string, unknown> => ({
  id: conversation.id,
  visitorName: conversation.visitorName,
  visitorEmail: conversation.visitorEmail,
  subject: conversation.subject,
  status: conversation.status,
  starred: conversation.starred,
  isSpam: conversation.isSpam,
  unreadForAdmin: conversation.unreadForAdmin,
  unreadForVisitor: conversation.unreadForVisitor,
  lastMessageAt: conversation.lastMessageAt,
  lastMessagePreview: conversation.lastMessagePreview,
  visitorLastSeenAt: conversation.visitorLastSeenAt,
  adminLastSeenAt: conversation.adminLastSeenAt,
  inviteExpiresAt: conversation.inviteExpiresAt,
  inviteSentAt: conversation.inviteSentAt,
  inviteRevokedAt: conversation.inviteRevokedAt,
  visitorVerifiedAt: conversation.visitorVerifiedAt,
  closedAt: conversation.closedAt,
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
});

export const toMessageEvent = (message: ChatMessage): Record<string, unknown> => ({
  id: message.id,
  seq: message.seq,
  conversationId: message.conversationId,
  sender: message.sender,
  body: message.body,
  imageUrl: publicMediaUrl(message.imageKey, null),
  clientMsgId: message.clientMsgId,
  deliveredAt: message.deliveredAt,
  readAt: message.readAt,
  createdAt: message.createdAt,
});

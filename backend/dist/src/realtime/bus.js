import { publicMediaUrl } from "../storage/index.js";
const noop = () => undefined;
const fallback = {
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
let implementation = fallback;
export const setChatRealtime = (next) => {
    implementation = next;
};
export const realtime = () => implementation;
/** Shared JSON shape for admin conversation events (never the invite hash). */
export const toConversationEvent = (conversation) => ({
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
export const toMessageEvent = (message) => ({
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
//# sourceMappingURL=bus.js.map
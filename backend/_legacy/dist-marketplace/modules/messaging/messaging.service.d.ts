export interface ParticipantProfile {
    accountId: string | null;
    participantType: string;
    role: "client" | "freelancer" | null;
    name: string;
    avatarUrl: string | null;
    professionalTitle: string | null;
    companyName: string | null;
}
export type CreateConversationInput = {
    recipientId?: string | undefined;
    jobId?: string | undefined;
    proposalId?: string | undefined;
};
export type SendMessageInput = {
    body?: string | undefined;
    replyToMessageId?: string | undefined;
    attachments: AttachmentInput[];
};
export interface AttachmentInput {
    fileId: string;
    fileUrl: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    attachmentType: string;
}
export declare const requireMember: (conversationId: string, userId: string) => Promise<{
    id: string;
    conversation_id: string;
    account_id: string | null;
    agency_id: string | null;
    participant_type: string;
    last_read_message_id: string | null;
    last_read_at: Date | null;
    unread_count: number;
    joined_at: Date;
    last_active_at: Date | null;
}>;
export declare const getConversations: (userId: string, agencyId?: string | null) => Promise<{
    conversations: {
        id: string;
        jobId: string | null;
        proposalId: string | null;
        lastMessageAt: Date | null;
        updatedAt: Date;
        unreadCount: number;
        jobTitle: string | null;
        lastMessage: {
            id: string;
            senderId: string | null;
            messageType: string;
            body: string | null;
            eventType: string | null;
            createdAt: Date;
        } | null;
        participants: ParticipantProfile[];
        activeMeeting: null;
    }[];
    totalUnread: number;
}>;
export declare const createConversation: (clientId: string, input: {
    recipientId?: string;
    jobId?: string;
    proposalId?: string;
}) => Promise<{
    id: string;
    jobId: string | null;
    proposalId: string | null;
    lastMessageAt: Date | null;
    updatedAt: Date;
    unreadCount: number;
    jobTitle: string | null;
    lastMessage: {
        id: string;
        senderId: string | null;
        messageType: string;
        body: string | null;
        eventType: string | null;
        createdAt: Date;
    } | null;
    participants: ParticipantProfile[];
    activeMeeting: null;
}>;
export declare const sendMessage: (conversationId: string, senderId: string, input: SendMessageInput) => Promise<{
    id: string;
    conversationId: string;
    senderId: string | null;
    messageType: string;
    body: string | null;
    eventType: string | null;
    eventPayload: Record<string, unknown> | null;
    replyToMessageId: string | null;
    createdAt: Date;
    attachments: {
        id: string;
        message_id: string;
        storage_key: string;
        file_url: string;
        file_name: string;
        mime_type: string;
        file_size: number;
        attachment_type: string;
        is_available: boolean;
        created_at: Date;
    }[];
    replyTo: {
        id: string;
        senderId: string | null;
        messageType: string;
        body: string | null;
        eventType: string | null;
    } | null;
}>;
export declare const getMessages: (conversationId: string, userId: string, cursor?: string, limit?: number) => Promise<{
    messages: {
        id: string;
        conversationId: string;
        senderId: string | null;
        messageType: string;
        body: string | null;
        eventType: string | null;
        eventPayload: Record<string, unknown> | null;
        replyToMessageId: string | null;
        createdAt: Date;
        attachments: {
            id: string;
            message_id: string;
            storage_key: string;
            file_url: string;
            file_name: string;
            mime_type: string;
            file_size: number;
            attachment_type: string;
            is_available: boolean;
            created_at: Date;
        }[];
        replyTo: {
            id: string;
            senderId: string | null;
            messageType: string;
            body: string | null;
            eventType: string | null;
        } | null;
    }[];
    nextCursor: string | null;
}>;
export declare const postSystemEventMessage: (conversationId: string, event: {
    eventType: string;
    eventPayload: Record<string, unknown>;
}, options?: {
    actorId?: string;
}) => Promise<{
    id: string;
    conversationId: string;
    senderId: string | null;
    messageType: string;
    body: string | null;
    eventType: string | null;
    eventPayload: Record<string, unknown> | null;
    replyToMessageId: string | null;
    createdAt: Date;
    attachments: {
        id: string;
        message_id: string;
        storage_key: string;
        file_url: string;
        file_name: string;
        mime_type: string;
        file_size: number;
        attachment_type: string;
        is_available: boolean;
        created_at: Date;
    }[];
    replyTo: {
        id: string;
        senderId: string | null;
        messageType: string;
        body: string | null;
        eventType: string | null;
    } | null;
}>;
export declare const markConversationRead: (conversationId: string, userId: string, lastReadMessageId: string) => Promise<{
    lastReadMessageId?: string | null;
    unreadCount?: number;
    conversationId: string;
}>;

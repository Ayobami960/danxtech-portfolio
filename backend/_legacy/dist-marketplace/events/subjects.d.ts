export declare const NOTIFICATIONS_STREAM = "NOTIFICATIONS";
export declare const NOTIFICATIONS_SUBJECT = "notifications.created";
export declare const NOTIFICATIONS_CONSUMER = "notifications-storage";
export interface NotificationEvent {
    eventId: string;
    /** Recipient account. Exactly one of recipientId / agencyId is set. */
    recipientId?: string;
    /** Recipient agency workspace. Exactly one of recipientId / agencyId is set. */
    agencyId?: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    metadata?: Record<string, unknown>;
    createdAt: string;
}

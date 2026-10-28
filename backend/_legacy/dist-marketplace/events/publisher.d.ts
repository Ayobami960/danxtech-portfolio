import { type NotificationEvent } from "./subjects.js";
export declare const sendNotification: (input: Omit<NotificationEvent, "eventId" | "createdAt">) => Promise<NotificationEvent>;

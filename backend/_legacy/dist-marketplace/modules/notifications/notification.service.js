import { and, desc, eq, or } from "drizzle-orm";
import { db } from "../../database/clients.js";
import { notifications } from "../../database/schema.js";
export const getNotifications = (userId, agencyId) => db
    .select()
    .from(notifications)
    .where(agencyId
    ? eq(notifications.agency_id, agencyId)
    : eq(notifications.recipient_id, userId))
    .orderBy(desc(notifications.created_at))
    .limit(10);
export const readAllNotifications = (userId, agencyId) => db
    .update(notifications)
    .set({ is_read: true, read_at: new Date() })
    .where(agencyId
    ? eq(notifications.agency_id, agencyId)
    : eq(notifications.recipient_id, userId));
export const readNotification = (userId, notificationId, agencyId) => db
    .update(notifications)
    .set({ is_read: true, read_at: new Date() })
    .where(and(eq(notifications.id, notificationId), agencyId
    ? or(eq(notifications.recipient_id, userId), eq(notifications.agency_id, agencyId))
    : eq(notifications.recipient_id, userId)))
    .returning({ id: notifications.id });
//# sourceMappingURL=notification.service.js.map
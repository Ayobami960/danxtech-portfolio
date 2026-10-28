import { asyncHandler } from "../../utils/async-handler.js";
import { getNotifications, readAllNotifications, readNotification, } from "./notification.service.js";
import { getAgencyIdForMember } from "../agency/agency.service.js";
import { addAgencyNotificationClient, addNotificationClient, } from "./notification.sse.js";
import { ApiError } from "../../utils/api-error.js";
const requestedScope = (value) => value === "agency" ? "agency" : "default";
const resolveScopeAgencyId = async (userId, scope) => scope === "agency" ? getAgencyIdForMember(userId) : null;
const requireNotificationId = (value) => {
    if (typeof value !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
        throw new ApiError(400, "Notification is invalid.");
    }
    return value;
};
export const listNotifications = asyncHandler(async (request, response) => {
    const scope = requestedScope(request.query.scope);
    const agencyId = await resolveScopeAgencyId(request.auth.userId, scope);
    const data = scope === "agency" && !agencyId
        ? []
        : await getNotifications(request.auth.userId, agencyId);
    response.json({
        success: true,
        message: "Notifications retrieved.",
        data,
    });
});
export const markAllNotificationsRead = asyncHandler(async (request, response) => {
    const scope = requestedScope(request.query.scope);
    const agencyId = await resolveScopeAgencyId(request.auth.userId, scope);
    if (scope !== "agency" || agencyId) {
        await readAllNotifications(request.auth.userId, agencyId);
    }
    response.json({
        success: true,
        message: "Notifications marked as read.",
    });
});
export const markNotificationRead = asyncHandler(async (request, response) => {
    const userId = request.auth.userId;
    const agencyId = await getAgencyIdForMember(userId);
    const [notification] = await readNotification(userId, requireNotificationId(request.params.id), agencyId);
    if (!notification)
        throw new ApiError(404, "Notification not found.");
    response.json({
        success: true,
        message: "Notification marked as read.",
        data: notification,
    });
});
export const notificationStream = async (request, response) => {
    response.set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
    });
    response.flushHeaders();
    response.write("event: connected\ndata: {}\n\n");
    const heartbeat = setInterval(() => response.write(": heartbeat\n\n"), 25_000);
    const scope = requestedScope(request.query.scope);
    const agencyId = await resolveScopeAgencyId(request.auth.userId, scope).catch(() => null);
    const removeClient = scope === "agency"
        ? agencyId
            ? addAgencyNotificationClient(agencyId, response)
            : () => { }
        : addNotificationClient(request.auth.userId, response);
    request.on("close", () => {
        clearInterval(heartbeat);
        removeClient();
    });
};
//# sourceMappingURL=notification.controller.js.map
import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { listNotifications, markAllNotificationsRead, markNotificationRead, notificationStream, } from "./notification.controller.js";
export const notificationRouter = Router();
notificationRouter.use(authenticate);
notificationRouter.get("/", listNotifications);
notificationRouter.get("/stream", notificationStream);
notificationRouter.patch("/read-all", markAllNotificationsRead);
notificationRouter.patch("/:id/read", markNotificationRead);
//# sourceMappingURL=notification.route.js.map
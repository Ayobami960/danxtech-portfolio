import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { createMessage, listConversations, listMessages, openConversation, readConversation } from "./messaging.controller.js";
import { createMeetingHandler } from "../meetings/meetings.controller.js";
export const messagingRouter = Router();
messagingRouter.use(authenticate);
messagingRouter.get("/", listConversations);
messagingRouter.post("/", openConversation);
messagingRouter.post("/:conversationId/messages", createMessage);
messagingRouter.get("/:conversationId/messages", listMessages);
messagingRouter.post("/:conversationId/read", readConversation);
// The dashboards start a video call from inside a conversation.
messagingRouter.post("/:conversationId/meetings", createMeetingHandler);
//# sourceMappingURL=messaging.route.js.map
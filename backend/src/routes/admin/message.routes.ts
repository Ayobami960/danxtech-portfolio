import type { Router } from "express";
import {
  deleteMessageHandler,
  getMessageHandler,
  listMessagesHandler,
  unreadCountHandler,
  updateMessageHandler,
} from "../../controllers/admin.message.controller.js";
import { validate } from "../../middleware/validate.js";
import { uuidParams } from "../../schemas/common.schemas.js";
import {
  messageListQuerySchema,
  updateMessageSchema,
} from "../../schemas/contact.schemas.js";

export const registerMessageRoutes = (router: Router): void => {
  router.get(
    "/messages",
    validate({ query: messageListQuerySchema }),
    listMessagesHandler,
  );

  // Registered before `/:id` so "unread-count" is never parsed as a message id.
  router.get("/messages/unread-count", unreadCountHandler);

  router.get(
    "/messages/:id",
    validate({ params: uuidParams }),
    getMessageHandler,
  );
  router.patch(
    "/messages/:id",
    validate({ params: uuidParams, body: updateMessageSchema }),
    updateMessageHandler,
  );
  router.delete(
    "/messages/:id",
    validate({ params: uuidParams }),
    deleteMessageHandler,
  );
};

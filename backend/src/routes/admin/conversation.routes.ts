import type { Router } from "express";
import {
  createInvite,
  deleteConversation,
  getConversation,
  getMessages,
  listConversations,
  markRead,
  revokeInvite,
  sendMessage,
  unreadCount,
  updateConversation,
  uploadImage,
} from "../../controllers/admin.conversation.controller.js";
import { validate } from "../../middleware/validate.js";
import { z } from "zod";
import {
  chatMessagesQuerySchema,
  chatSendSchema,
  conversationListQuerySchema,
  inviteSchema,
  updateConversationSchema,
} from "../../schemas/chat.schemas.js";
import { signedUploadResultSchema } from "../../schemas/project.schemas.js";

const idParams = z.object({ id: z.uuid() }).strict();

export const registerConversationRoutes = (router: Router): void => {
  router.get(
    "/conversations",
    validate({ query: conversationListQuerySchema }),
    listConversations,
  );
  // Registered before `/:id` so "unread-count" is not parsed as an id.
  router.get("/conversations/unread-count", unreadCount);

  router.get("/conversations/:id", validate({ params: idParams }), getConversation);
  router.get(
    "/conversations/:id/messages",
    validate({ params: idParams, query: chatMessagesQuerySchema }),
    getMessages,
  );
  router.post(
    "/conversations/:id/messages",
    validate({ params: idParams, body: chatSendSchema }),
    sendMessage,
  );
  router.post(
    "/conversations/:id/read",
    validate({ params: idParams }),
    markRead,
  );
  // JSON only: the admin already uploaded the image to Cloudinary.
  router.post(
    "/conversations/:id/images",
    validate({ params: idParams, body: signedUploadResultSchema }),
    uploadImage,
  );
  router.patch(
    "/conversations/:id",
    validate({ params: idParams, body: updateConversationSchema }),
    updateConversation,
  );
  router.delete(
    "/conversations/:id",
    validate({ params: idParams }),
    deleteConversation,
  );

  router.post(
    "/conversations/:id/invite",
    validate({ params: idParams, body: inviteSchema }),
    createInvite,
  );
  router.post(
    "/conversations/:id/invite/resend",
    validate({ params: idParams, body: inviteSchema }),
    createInvite,
  );
  router.delete(
    "/conversations/:id/invite",
    validate({ params: idParams }),
    revokeInvite,
  );
};

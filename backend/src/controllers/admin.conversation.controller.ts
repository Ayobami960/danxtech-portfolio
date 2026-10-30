import { asyncHandler } from "../lib/async-handler.js";
import { latestSeq } from "../repositories/chat.repository.js";
import { body as readBody, params, query } from "../lib/request.js";
import type {
  ChatSendInput,
  ConversationListQuery,
  InviteInput,
  UpdateConversationInput,
} from "../schemas/chat.schemas.js";
import type { SignedUploadResult } from "../lib/uploads.js";
import * as chat from "../services/chat.service.js";

export const listConversations = asyncHandler(async (request, response) => {
  const queryParams = query<ConversationListQuery>(request);
  const { rows, total } = await chat.adminListConversations(queryParams);
  response.status(200).json({
    data: rows,
    meta: {
      page: queryParams.page,
      pageSize: queryParams.pageSize,
      total,
    },
  });
});

export const unreadCount = asyncHandler(async (_request, response) => {
  response.status(200).json({ unread: await chat.adminUnreadCount() });
});

export const getConversation = asyncHandler(async (request, response) => {
  const { id } = params<{ id: string }>(request);
  response.status(200).json(await chat.adminGetConversation(id));
});

export const getMessages = asyncHandler(async (request, response) => {
  const { id } = params<{ id: string }>(request);
  const { before, limit } = query<{ before?: number; limit: number }>(request);
  response.status(200).json(await chat.adminMessagePage(id, { before, limit }));
});

export const sendMessage = asyncHandler(async (request, response) => {
  const { id } = params<{ id: string }>(request);
  const input = readBody<ChatSendInput>(request);
  response.status(201).json(await chat.adminSendMessage(request, id, input));
});

export const uploadImage = asyncHandler(async (request, response) => {
  const { id } = params<{ id: string }>(request);
  await chat.adminGetConversation(id);
  const body = readBody<SignedUploadResult>(request);
  response
    .status(201)
    .json(await chat.storeChatImage(request, id, body));
});

export const markRead = asyncHandler(async (request, response) => {
  const { id } = params<{ id: string }>(request);
  response
    .status(200)
    .json(await chat.markSeen(id, "admin", await latestSeq(id)));
});

export const updateConversation = asyncHandler(async (request, response) => {
  const { id } = params<{ id: string }>(request);
  const input = readBody<UpdateConversationInput>(request);
  response.status(200).json(await chat.adminUpdateConversation(request, id, input));
});

export const deleteConversation = asyncHandler(async (request, response) => {
  const { id } = params<{ id: string }>(request);
  await chat.adminDeleteConversation(request, id);
  response.status(204).end();
});

export const createInvite = asyncHandler(async (request, response) => {
  const { id } = params<{ id: string }>(request);
  const input = readBody<InviteInput>(request);
  response.status(200).json(await chat.sendInvite(request, id, input));
});

export const revokeInvite = asyncHandler(async (request, response) => {
  const { id } = params<{ id: string }>(request);
  await chat.revokeInvite(request, id);
  response.status(204).end();
});

import { asyncHandler } from "../lib/async-handler.js";
import { paginated } from "../lib/pagination.js";
import { body as readBody, params, query } from "../lib/request.js";
import type {
  MessageListQuery,
  MessageUpdateInput,
} from "../schemas/contact.schemas.js";
import {
  deleteMessage,
  getMessage,
  listMessages,
  unreadCount,
  updateMessage,
} from "../services/contact.service.js";

export const listMessagesHandler = asyncHandler(async (request, response) => {
  const filters = query<MessageListQuery>(request);
  const { rows, total } = await listMessages(filters);
  const { page, pageSize } = filters;
  response.status(200).json(paginated(rows, total, { page, pageSize }));
});

export const unreadCountHandler = asyncHandler(async (_request, response) => {
  response.status(200).json({ unread: await unreadCount() });
});

export const getMessageHandler = asyncHandler(async (request, response) => {
  const { id } = params<{ id: string }>(request);
  response.status(200).json(await getMessage(id));
});

export const updateMessageHandler = asyncHandler(async (request, response) => {
  const { id } = params<{ id: string }>(request);
  const input = readBody<MessageUpdateInput>(request);
  response.status(200).json(await updateMessage(request, id, input));
});

export const deleteMessageHandler = asyncHandler(async (request, response) => {
  const { id } = params<{ id: string }>(request);
  await deleteMessage(request, id);
  response.status(204).end();
});

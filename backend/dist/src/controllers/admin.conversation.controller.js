import { asyncHandler } from "../lib/async-handler.js";
import { latestSeq } from "../repositories/chat.repository.js";
import { body as readBody, params, query } from "../lib/request.js";
import * as chat from "../services/chat.service.js";
export const listConversations = asyncHandler(async (request, response) => {
    const queryParams = query(request);
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
    const { id } = params(request);
    response.status(200).json(await chat.adminGetConversation(id));
});
export const getMessages = asyncHandler(async (request, response) => {
    const { id } = params(request);
    const { before, limit } = query(request);
    response.status(200).json(await chat.adminMessagePage(id, { before, limit }));
});
export const sendMessage = asyncHandler(async (request, response) => {
    const { id } = params(request);
    const input = readBody(request);
    response.status(201).json(await chat.adminSendMessage(request, id, input));
});
export const uploadImage = asyncHandler(async (request, response) => {
    const { id } = params(request);
    await chat.adminGetConversation(id);
    response
        .status(201)
        .json(await chat.storeChatImage(request, id, request.file));
});
export const markRead = asyncHandler(async (request, response) => {
    const { id } = params(request);
    response
        .status(200)
        .json(await chat.markSeen(id, "admin", await latestSeq(id)));
});
export const updateConversation = asyncHandler(async (request, response) => {
    const { id } = params(request);
    const input = readBody(request);
    response.status(200).json(await chat.adminUpdateConversation(request, id, input));
});
export const deleteConversation = asyncHandler(async (request, response) => {
    const { id } = params(request);
    await chat.adminDeleteConversation(request, id);
    response.status(204).end();
});
export const createInvite = asyncHandler(async (request, response) => {
    const { id } = params(request);
    const input = readBody(request);
    response.status(200).json(await chat.sendInvite(request, id, input));
});
export const revokeInvite = asyncHandler(async (request, response) => {
    const { id } = params(request);
    await chat.revokeInvite(request, id);
    response.status(204).end();
});
//# sourceMappingURL=admin.conversation.controller.js.map
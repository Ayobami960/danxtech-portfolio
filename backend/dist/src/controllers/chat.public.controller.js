import { asyncHandler } from "../lib/async-handler.js";
import { body as readBody, query } from "../lib/request.js";
import { clearChatSessionCookie } from "../lib/cookies.js";
import * as chat from "../services/chat.service.js";
import * as verification from "../services/chat-verification.service.js";
const session = (request) => chat.guestConversationId(request);
/** Step 1 of the flow: request a code for the email on the conversation. */
export const chatVerifyRequest = asyncHandler(async (request, response) => {
    const input = readBody(request);
    response.status(200).json(await verification.requestCode(request, input));
});
/** Step 2: confirm the code and receive the visitor session. */
export const chatVerifyConfirm = asyncHandler(async (request, response) => {
    const input = readBody(request);
    response.status(200).json(await verification.confirmCode(request, response, input));
});
/** Rejoin with an existing session (page reload / returning visitor). */
export const chatJoin = asyncHandler(async (request, response) => {
    response.status(200).json(await chat.guestJoin(request));
});
export const chatLogout = asyncHandler(async (_request, response) => {
    clearChatSessionCookie(response);
    response.status(204).end();
});
export const chatMessages = asyncHandler(async (request, response) => {
    const conversationId = await session(request);
    const { before, limit } = query(request);
    response
        .status(200)
        .json(await chat.guestMessages(conversationId, { before, limit }));
});
export const chatSendMessage = asyncHandler(async (request, response) => {
    const conversationId = await session(request);
    const input = readBody(request);
    response.status(201).json(await chat.guestSendMessage(conversationId, input));
});
export const chatUploadImage = asyncHandler(async (request, response) => {
    const conversationId = await session(request);
    response
        .status(201)
        .json(await chat.storeChatImage(request, conversationId, request.file));
});
export const chatSeen = asyncHandler(async (request, response) => {
    const conversationId = await session(request);
    const { upToSeq } = readBody(request);
    response.status(200).json(await chat.markSeen(conversationId, "visitor", upToSeq));
});
//# sourceMappingURL=chat.public.controller.js.map
import { createHmac, timingSafeEqual } from "crypto";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { endMeetingByRoomName, startMeeting } from "./meetings.service.js";
export const createMeetingHandler = asyncHandler(async (request, response) => {
    if (!request.auth)
        throw new ApiError(401, "Authentication is required.");
    const conversationId = request.params.conversationId;
    if (typeof conversationId !== "string" || !conversationId) {
        throw new ApiError(400, "Conversation id is required.");
    }
    const data = await startMeeting(conversationId, request.auth.userId);
    await logger.info({
        message: "Meeting created",
        eventName: "task.meeting.created",
        attributes: {
            "task.meeting.id": data.id,
            "task.meeting.conversation_id": conversationId,
            "user.id": request.auth.userId,
        },
    });
    response.status(201).json({
        success: true,
        message: "Meeting created.",
        data,
    });
});
const verifyDailySignature = (rawBody, timestamp, signature) => {
    if (!env.dailyWebhookSecret)
        return false;
    let parsedEvent;
    try {
        parsedEvent = JSON.parse(rawBody.toString("utf8"));
    }
    catch {
        return false;
    }
    const signedPayload = `${timestamp}.${JSON.stringify(parsedEvent)}`;
    const decodedSecret = Buffer.from(env.dailyWebhookSecret, "base64");
    const computed = createHmac("sha256", decodedSecret)
        .update(signedPayload)
        .digest("base64");
    const expected = Buffer.from(computed);
    const received = Buffer.from(signature);
    return (expected.length === received.length &&
        timingSafeEqual(expected, received));
};
export const dailyWebhookHandler = asyncHandler(async (request, response) => {
    const timestamp = request.headers["x-webhook-timestamp"];
    const signature = request.headers["x-webhook-signature"];
    const rawBody = request.body;
    if (typeof timestamp !== "string" ||
        typeof signature !== "string" ||
        !Buffer.isBuffer(rawBody) ||
        !verifyDailySignature(rawBody, timestamp, signature)) {
        await logger.warn({
            message: "Webhook signature rejected",
            eventName: "webhook.inbound.rejected",
            attributes: {
                "webhook.source": "daily",
                "webhook.reject_reason": "invalid_signature",
            },
        });
        throw new ApiError(400, "Invalid Daily webhook signature.");
    }
    const event = JSON.parse(rawBody.toString("utf8"));
    if (event.type === "meeting.ended" && event.payload?.room) {
        const ended = await endMeetingByRoomName(event.payload.room);
        if (ended) {
            await logger.info({
                message: "Meeting ended",
                eventName: "task.meeting.completed",
                attributes: {
                    "task.meeting.id": ended.id,
                    "task.meeting.conversation_id": ended.conversationId,
                    "task.meeting.duration_minutes": ended.durationMinutes,
                },
            });
        }
    }
    response.status(200).json({ success: true, message: "Webhook processed." });
});
//# sourceMappingURL=meetings.controller.js.map
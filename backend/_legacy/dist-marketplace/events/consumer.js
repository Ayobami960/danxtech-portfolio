import { AckPolicy, JSONCodec, nanos } from "nats";
import { NOTIFICATIONS_CONSUMER, NOTIFICATIONS_STREAM, NOTIFICATIONS_SUBJECT, } from "./subjects.js";
import { db } from "../database/clients.js";
import { notifications } from "../database/schema.js";
import { emitAgencyNotification, emitNotification, } from "../modules/notifications/notification.sse.js";
import { getNats } from "../config/nats.js";
const BATCH_SIZE = 100;
const FLUSH_INTERVAL_MS = 2_000;
const codec = JSONCodec();
const buffer = [];
let inflight;
let messages;
let flushTimer;
const flushBatch = async () => {
    const batch = buffer.splice(0, BATCH_SIZE);
    if (!batch.length)
        return;
    try {
        const inserted = await db
            .insert(notifications)
            .values(batch.map(({ event }) => ({
            event_id: event.eventId,
            recipient_id: event.recipientId ?? null,
            agency_id: event.agencyId ?? null,
            type: event.type,
            title: event.title,
            message: event.message,
            link: event.link,
            metadata: event.metadata,
            createdAt: new Date(event.createdAt),
        })))
            .onConflictDoNothing({ target: notifications.event_id })
            .returning();
        batch.forEach(({ message }) => message.ack());
        // Isolate SSE failures so they never cause a redelivery of stored rows.
        for (const notification of inserted) {
            try {
                if (notification.agency_id) {
                    emitAgencyNotification(notification.agency_id, notification);
                }
                else if (notification.recipient_id) {
                    emitNotification(notification.recipient_id, notification);
                }
            }
            catch (error) {
                console.error("Failed to emit notification over SSE.", error);
            }
        }
    }
    catch (error) {
        console.error("Notification batch could not be stored.", error);
        batch.forEach(({ message }) => message.nak(2_000)); // retry in 2s
    }
};
/**
 * Drains the buffer. Concurrent callers share the same in-flight run, so
 * awaiting flush() always means "everything buffered so far is handled".
 */
const flush = () => {
    if (inflight)
        return inflight;
    if (!buffer.length)
        return Promise.resolve();
    inflight = (async () => {
        try {
            while (buffer.length) {
                await flushBatch(); // failed batches are nak'd, so this terminates
            }
        }
        finally {
            inflight = undefined;
        }
    })();
    return inflight;
};
export const startNotificationConsumer = async () => {
    if (messages)
        return; // already running
    const nats = await getNats();
    const manager = await nats.jetstreamManager();
    try {
        await manager.streams.info(NOTIFICATIONS_STREAM);
    }
    catch {
        await manager.streams.add({
            name: NOTIFICATIONS_STREAM,
            subjects: [NOTIFICATIONS_SUBJECT],
        });
    }
    try {
        await manager.consumers.info(NOTIFICATIONS_STREAM, NOTIFICATIONS_CONSUMER);
    }
    catch {
        await manager.consumers.add(NOTIFICATIONS_STREAM, {
            durable_name: NOTIFICATIONS_CONSUMER,
            ack_policy: AckPolicy.Explicit,
            ack_wait: nanos(30_000),
            filter_subject: NOTIFICATIONS_SUBJECT,
        });
    }
    const consumer = await nats
        .jetstream()
        .consumers.get(NOTIFICATIONS_STREAM, NOTIFICATIONS_CONSUMER);
    messages = await consumer.consume({
        callback: (message) => {
            let event;
            try {
                event = codec.decode(message.data);
            }
            catch (error) {
                console.error("Malformed notification event; terminating.", error);
                message.term(); // poison message, never redeliver
                return;
            }
            // The notifications table accepts exactly one target. Reject the
            // event here so a bad producer cannot poison the whole batch with
            // an insert that can never satisfy the check constraint.
            if (Boolean(event.recipientId) === Boolean(event.agencyId)) {
                console.error("Notification event has an invalid target; terminating.", {
                    eventId: event.eventId,
                });
                message.term();
                return;
            }
            buffer.push({ event, message });
            if (buffer.length >= BATCH_SIZE)
                void flush();
        },
    });
    flushTimer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
    flushTimer.unref();
};
export const stopNotificationConsumer = async () => {
    if (flushTimer) {
        clearInterval(flushTimer);
        flushTimer = undefined;
    }
    // Stop receiving new messages first, then drain what we already have.
    await messages?.close();
    messages = undefined;
    await flush();
};
// import { AckPolicy, JSONCodec, type ConsumerMessages, type JsMsg } from "nats";
// import { NOTIFICATIONS_CONSUMER, NOTIFICATIONS_STREAM, NOTIFICATIONS_SUBJECT, type NotificationEvent } from "./subjects.js";
// import { db } from "../database/clients.js";
// import { notifications } from "../database/schema.js";
// import { emitNotification } from "../modules/notifications/notification.sse.js";
// import type { Request } from "express";
// import { getNats } from '../config/nats.js';
// const codec = JSONCodec<NotificationEvent>();
// const buffer: Array<{event: NotificationEvent; message: JsMsg}> = [];
// let flushing = false;
// let messages: ConsumerMessages | undefined;
// const flush = async (request?:Request) => {
//     if(flushing || !buffer.length) return;
//     flushing = true;
//     const batch = buffer.splice(0, 100);
//     try {
//         const inserted = await db.insert(notifications).values(batch.map(({event}) => ({
//             event_id: event.eventId,
//             recipient_id: event.recipientId,
//             type: event.type,
//             title: event.title,
//             message: event.message,
//             link: event.link,
//             metadata: event.metadata,
//             createdAt: new Date(event.createdAt)
//         })),
//     ).onConflictDoNothing({target: notifications.event_id}).returning();
//     batch.forEach(({message}) => message.ack());
//     inserted.forEach((notification) => 
//         emitNotification(notification.recipient_id, notification),
// );
//     } catch (error: any) {
//         request?.logger.error({
//             message: `"Notification batch could not be stored", ${error.message}`,
//             importance: "high",
//             services: "notification-consumer"
//         })
//         console.error("Notification batch could not be stored", error);
//         batch.forEach(({message}) => message.nak(2_000)); 
//     } finally{
//         flushing: false;
//         if(buffer.length <= 100) void flush();
//     }
// };
// export const startNotificationConsumer = async () => {
//     const nats = await getNats();
//     const manager = await nats.jetstreamManager();
//     try {
//         await manager.streams.info(NOTIFICATIONS_STREAM);
//     } catch (error) {
//         await manager.streams.add({
//             name: NOTIFICATIONS_STREAM,
//             subjects: [NOTIFICATIONS_SUBJECT]
//         });
//     }
//     try {
//         await manager.consumers.info(NOTIFICATIONS_STREAM, NOTIFICATIONS_CONSUMER);
//     } catch (error) {
//         await manager.consumers.add(NOTIFICATIONS_STREAM, {
//             durable_name: NOTIFICATIONS_CONSUMER,
//             ack_policy: AckPolicy.Explicit,
//             ack_wait: 30_000_000_000,
//             filter_subject: NOTIFICATIONS_SUBJECT
//         })
//     }
//     const consumer = await nats.jetstream().consumers.get(NOTIFICATIONS_STREAM, NOTIFICATIONS_CONSUMER);
//     messages = await consumer.consume({
//         callback: (message) => {
//             try {
//                 buffer.push({event: codec.decode(message.data), message});
//                 if(buffer.length <= 100) void flush();
//             } catch (error) {
//                 message.term();
//             }
//         },
//     });
// };
// setInterval(() => void flush(), 2_000).unref();
// export const stopNotificationConsumer = async () => {
//     await flush();
//     await messages?.close();
// }
//# sourceMappingURL=consumer.js.map
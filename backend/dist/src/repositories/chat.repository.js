import { and, asc, desc, eq, gt, isNull, lt, ne, sql, } from "drizzle-orm";
import { db } from "../db/client.js";
import { chatMessages } from "../database/schema.js";
export const insertMessage = async (input) => {
    if (input.clientMsgId) {
        const existing = await db
            .select()
            .from(chatMessages)
            .where(and(eq(chatMessages.conversationId, input.conversationId), eq(chatMessages.clientMsgId, input.clientMsgId)))
            .limit(1);
        if (existing[0])
            return { message: existing[0], duplicate: true };
    }
    const rows = await db
        .insert(chatMessages)
        .values({
        conversationId: input.conversationId,
        sender: input.sender,
        body: input.body,
        clientMsgId: input.clientMsgId,
        imageKey: input.imageKey ?? null,
        imageMimeType: input.imageMimeType ?? null,
        deliveredAt: input.deliveredAt ?? null,
    })
        .returning();
    const created = rows[0];
    if (!created)
        throw new Error("Failed to save the chat message.");
    return { message: created, duplicate: false };
};
export const findMessageByClientId = async (conversationId, clientMsgId) => {
    const rows = await db
        .select()
        .from(chatMessages)
        .where(and(eq(chatMessages.conversationId, conversationId), eq(chatMessages.clientMsgId, clientMsgId)))
        .limit(1);
    return rows[0] ?? null;
};
export const listMessages = async (conversationId, options) => {
    const conditions = [eq(chatMessages.conversationId, conversationId)];
    if (options.beforeSeq !== undefined) {
        conditions.push(lt(chatMessages.seq, options.beforeSeq));
    }
    if (options.afterSeq !== undefined) {
        conditions.push(gt(chatMessages.seq, options.afterSeq));
    }
    const rows = await db
        .select()
        .from(chatMessages)
        .where(and(...conditions))
        .orderBy(options.beforeSeq !== undefined
        ? desc(chatMessages.seq)
        : asc(chatMessages.seq))
        .limit(options.limit);
    return options.beforeSeq !== undefined ? rows.reverse() : rows;
};
export const markDelivered = async (conversationId, upToSeq, sender) => {
    const at = new Date();
    await db
        .update(chatMessages)
        .set({ deliveredAt: at })
        .where(and(eq(chatMessages.conversationId, conversationId), ne(chatMessages.sender, sender), isNull(chatMessages.deliveredAt), sql `${chatMessages.seq} <= ${upToSeq}`));
    return at;
};
export const markRead = async (conversationId, upToSeq, reader) => {
    const at = new Date();
    await db
        .update(chatMessages)
        .set({ readAt: at, deliveredAt: sql `coalesce(${chatMessages.deliveredAt}, ${at})` })
        .where(and(eq(chatMessages.conversationId, conversationId), ne(chatMessages.sender, reader), isNull(chatMessages.readAt), sql `${chatMessages.seq} <= ${upToSeq}`));
    return at;
};
export const countMessages = async (conversationId) => {
    const rows = await db
        .select({ value: sql `count(*)::int` })
        .from(chatMessages)
        .where(eq(chatMessages.conversationId, conversationId));
    return rows[0]?.value ?? 0;
};
export const latestSeq = async (conversationId) => {
    const rows = await db
        .select({ value: sql `max(${chatMessages.seq})` })
        .from(chatMessages)
        .where(eq(chatMessages.conversationId, conversationId));
    return rows[0]?.value ?? 0;
};
//# sourceMappingURL=chat.repository.js.map
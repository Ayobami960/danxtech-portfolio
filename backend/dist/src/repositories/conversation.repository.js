import { and, count, desc, eq, gt, ilike, inArray, isNull, lt, or, sql, } from "drizzle-orm";
import { db } from "../db/client.js";
import { chatMessages, conversations, } from "../database/schema.js";
const escapeLike = (value) => value.replace(/[\\%_]/g, (character) => `\\${character}`);
const buildFilters = (filters) => {
    const conditions = [];
    if (filters.status)
        conditions.push(eq(conversations.status, filters.status));
    if (filters.starred !== undefined) {
        conditions.push(eq(conversations.starred, filters.starred));
    }
    if (filters.isSpam !== undefined) {
        conditions.push(eq(conversations.isSpam, filters.isSpam));
    }
    if (filters.unread)
        conditions.push(gt(conversations.unreadForAdmin, 0));
    if (filters.q) {
        const pattern = `%${escapeLike(filters.q)}%`;
        const search = or(ilike(conversations.visitorName, pattern), ilike(conversations.visitorEmail, pattern), ilike(conversations.subject, pattern), ilike(conversations.lastMessagePreview, pattern));
        if (search)
            conditions.push(search);
    }
    return conditions.length > 0 ? and(...conditions) : undefined;
};
export const createConversation = async (input) => {
    const rows = await db.insert(conversations).values(input).returning();
    const created = rows[0];
    if (!created)
        throw new Error("Failed to create the conversation.");
    return created;
};
export const listConversations = async (filters, page, pageSize) => {
    const where = buildFilters(filters);
    const [rows, totals] = await Promise.all([
        db
            .select()
            .from(conversations)
            .where(where)
            .orderBy(desc(conversations.lastMessageAt))
            .limit(pageSize)
            .offset((page - 1) * pageSize),
        db.select({ value: count() }).from(conversations).where(where),
    ]);
    return { rows, total: totals[0]?.value ?? 0 };
};
export const findConversationById = async (id) => {
    const rows = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, id))
        .limit(1);
    return rows[0] ?? null;
};
export const findConversationByInviteHash = async (hash) => {
    const rows = await db
        .select()
        .from(conversations)
        .where(eq(conversations.inviteTokenHash, hash))
        .limit(1);
    return rows[0] ?? null;
};
export const updateConversation = async (id, input) => {
    const rows = await db
        .update(conversations)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(conversations.id, id))
        .returning();
    return rows[0] ?? null;
};
export const deleteConversation = async (id) => {
    await db.delete(conversations).where(eq(conversations.id, id));
};
export const countUnreadConversations = async () => {
    const rows = await db
        .select({ value: count() })
        .from(conversations)
        .where(and(eq(conversations.isSpam, false), gt(conversations.unreadForAdmin, 0)));
    return rows[0]?.value ?? 0;
};
export const countOpenConversations = async () => {
    const rows = await db
        .select({ value: count() })
        .from(conversations)
        .where(inArray(conversations.status, ["new", "open"]));
    return rows[0]?.value ?? 0;
};
export const countConversations = async () => {
    const rows = await db.select({ value: count() }).from(conversations);
    return rows[0]?.value ?? 0;
};
export const incrementUnread = async (id, side) => {
    await db
        .update(conversations)
        .set(side === "admin"
        ? { unreadForAdmin: sql `${conversations.unreadForAdmin} + 1` }
        : { unreadForVisitor: sql `${conversations.unreadForVisitor} + 1` })
        .where(eq(conversations.id, id));
};
export const resetUnread = async (id, side, seenAt) => {
    await db
        .update(conversations)
        .set(side === "admin"
        ? { unreadForAdmin: 0, adminLastSeenAt: seenAt }
        : { unreadForVisitor: 0, visitorLastSeenAt: seenAt })
        .where(eq(conversations.id, id));
};
export const touchConversation = async (id, preview, at) => {
    await db
        .update(conversations)
        .set({
        lastMessagePreview: preview.slice(0, 160),
        lastMessageAt: at,
        ...(await statusAfterMessage(id)),
    })
        .where(eq(conversations.id, id));
};
/** A reply moves a `new` conversation to `open`; closed stays closed. */
const statusAfterMessage = async (id) => {
    const current = await findConversationById(id);
    return current && current.status === "new" ? { status: "open" } : {};
};
export const closeIdleConversations = async (idleDays) => {
    const cutoff = new Date(Date.now() - idleDays * 24 * 60 * 60 * 1000);
    const rows = await db
        .update(conversations)
        .set({ status: "closed", closedAt: new Date(), updatedAt: new Date() })
        .where(and(inArray(conversations.status, ["new", "open"]), lt(conversations.lastMessageAt, cutoff)))
        .returning({ id: conversations.id });
    return rows.length;
};
export const deleteClosedConversations = async (olderThanDays) => {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const rows = await db
        .delete(conversations)
        .where(and(eq(conversations.status, "closed"), lt(conversations.closedAt, cutoff)))
        .returning({ id: conversations.id });
    return rows.length;
};
export const countRecentMessages = async (conversationId, sender, since) => {
    const rows = await db
        .select({ value: count() })
        .from(chatMessages)
        .where(and(eq(chatMessages.conversationId, conversationId), eq(chatMessages.sender, sender), gt(chatMessages.createdAt, since)));
    return rows[0]?.value ?? 0;
};
export const latestMessageAt = async () => {
    const rows = await db
        .select({ value: chatMessages.createdAt })
        .from(chatMessages)
        .orderBy(desc(chatMessages.createdAt))
        .limit(1);
    return rows[0]?.value ?? null;
};
export const conversationsWithLiveInvite = async () => db
    .select({
    id: conversations.id,
    inviteExpiresAt: conversations.inviteExpiresAt,
})
    .from(conversations)
    .where(and(isNull(conversations.inviteRevokedAt), gt(conversations.inviteExpiresAt, new Date())));
//# sourceMappingURL=conversation.repository.js.map
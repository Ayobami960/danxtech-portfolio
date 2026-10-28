import { and, count, desc, eq, gte, ilike, or, } from "drizzle-orm";
import { db } from "../db/client.js";
import { contactMessages, } from "../database/schema.js";
const escapeLike = (value) => value.replace(/[\\%_]/g, (character) => `\\${character}`);
export const createContactMessage = async (input) => {
    const rows = await db.insert(contactMessages).values(input).returning();
    const created = rows[0];
    if (!created)
        throw new Error("Failed to save the contact message.");
    return created;
};
export const findRecentDuplicate = async (email, messageHash, since) => {
    const rows = await db
        .select()
        .from(contactMessages)
        .where(and(eq(contactMessages.email, email), eq(contactMessages.messageHash, messageHash), gte(contactMessages.createdAt, since)))
        .limit(1);
    return rows[0] ?? null;
};
const buildFilters = (filters) => {
    const conditions = [];
    if (filters.status) {
        conditions.push(eq(contactMessages.status, filters.status));
    }
    if (filters.starred !== undefined) {
        conditions.push(eq(contactMessages.starred, filters.starred));
    }
    if (filters.isSpam !== undefined) {
        conditions.push(eq(contactMessages.isSpam, filters.isSpam));
    }
    if (filters.q) {
        const pattern = `%${escapeLike(filters.q)}%`;
        const search = or(ilike(contactMessages.name, pattern), ilike(contactMessages.email, pattern), ilike(contactMessages.subject, pattern), ilike(contactMessages.message, pattern));
        if (search)
            conditions.push(search);
    }
    return conditions.length > 0 ? and(...conditions) : undefined;
};
export const listContactMessages = async (filters, page, pageSize) => {
    const where = buildFilters(filters);
    const [rows, totals] = await Promise.all([
        db
            .select()
            .from(contactMessages)
            .where(where)
            .orderBy(desc(contactMessages.createdAt))
            .limit(pageSize)
            .offset((page - 1) * pageSize),
        db.select({ value: count() }).from(contactMessages).where(where),
    ]);
    return { rows, total: totals[0]?.value ?? 0 };
};
export const countUnreadMessages = async () => {
    const rows = await db
        .select({ value: count() })
        .from(contactMessages)
        .where(eq(contactMessages.status, "unread"));
    return rows[0]?.value ?? 0;
};
export const countAllMessages = async () => {
    const rows = await db.select({ value: count() }).from(contactMessages);
    return rows[0]?.value ?? 0;
};
export const findContactMessageById = async (id) => {
    const rows = await db
        .select()
        .from(contactMessages)
        .where(eq(contactMessages.id, id))
        .limit(1);
    return rows[0] ?? null;
};
export const updateContactMessage = async (id, input) => {
    const rows = await db
        .update(contactMessages)
        .set(input)
        .where(eq(contactMessages.id, id))
        .returning();
    return rows[0] ?? null;
};
export const deleteContactMessage = async (id) => {
    await db.delete(contactMessages).where(eq(contactMessages.id, id));
};
//# sourceMappingURL=contact.repository.js.map
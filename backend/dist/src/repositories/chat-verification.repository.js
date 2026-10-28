import { and, count, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { chatVerificationCodes, } from "../database/schema.js";
export const createVerificationCode = async (input) => {
    const rows = await db.insert(chatVerificationCodes).values(input).returning();
    const created = rows[0];
    if (!created)
        throw new Error("Failed to store the verification code.");
    return created;
};
/** Newest unused code for this conversation + email (the only one accepted). */
export const findActiveCode = async (conversationId, email) => {
    const rows = await db
        .select()
        .from(chatVerificationCodes)
        .where(and(eq(chatVerificationCodes.conversationId, conversationId), eq(chatVerificationCodes.email, email), sql `${chatVerificationCodes.consumedAt} is null`))
        .orderBy(sql `${chatVerificationCodes.createdAt} desc`)
        .limit(1);
    return rows[0] ?? null;
};
export const latestCodeCreatedAt = async (conversationId) => {
    const rows = await db
        .select({ value: chatVerificationCodes.createdAt })
        .from(chatVerificationCodes)
        .where(eq(chatVerificationCodes.conversationId, conversationId))
        .orderBy(sql `${chatVerificationCodes.createdAt} desc`)
        .limit(1);
    return rows[0]?.value ?? null;
};
export const countCodesSince = async (conversationId, since) => {
    const rows = await db
        .select({ value: count() })
        .from(chatVerificationCodes)
        .where(and(eq(chatVerificationCodes.conversationId, conversationId), gt(chatVerificationCodes.createdAt, since)));
    return rows[0]?.value ?? 0;
};
export const registerFailedAttempt = async (id) => {
    const rows = await db
        .update(chatVerificationCodes)
        .set({ attempts: sql `${chatVerificationCodes.attempts} + 1` })
        .where(eq(chatVerificationCodes.id, id))
        .returning({ attempts: chatVerificationCodes.attempts });
    return rows[0]?.attempts ?? 0;
};
export const consumeCode = async (id, at) => {
    await db
        .update(chatVerificationCodes)
        .set({ consumedAt: at })
        .where(eq(chatVerificationCodes.id, id));
};
/** Housekeeping: drop codes that can no longer be used. */
export const deleteStaleCodes = async (olderThan) => {
    const rows = await db
        .delete(chatVerificationCodes)
        .where(lt(chatVerificationCodes.createdAt, olderThan))
        .returning({ id: chatVerificationCodes.id });
    return rows.length;
};
//# sourceMappingURL=chat-verification.repository.js.map
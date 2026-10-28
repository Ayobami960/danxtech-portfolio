import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "../db/client.js";
import { refreshTokens, } from "../database/schema.js";
export const createRefreshToken = async (input) => {
    const rows = await db.insert(refreshTokens).values(input).returning();
    const created = rows[0];
    if (!created)
        throw new Error("Failed to create a refresh token.");
    return created;
};
export const findRefreshTokenByHash = async (tokenHash) => {
    const rows = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
        .limit(1);
    return rows[0] ?? null;
};
export const revokeRefreshToken = async (id, replacedById) => {
    await db
        .update(refreshTokens)
        .set({ revokedAt: new Date(), replacedById })
        .where(and(eq(refreshTokens.id, id), isNull(refreshTokens.revokedAt)));
};
/**
 * Revoke every still-active token in a family. Used when a rotated token is
 * replayed: whoever holds an old copy must not be able to keep a session.
 */
export const revokeRefreshFamily = async (familyId) => {
    await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
};
export const revokeAllRefreshTokensForUser = async (userId) => {
    await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
};
/** Delete tokens that are past expiry or were revoked long ago. */
export const deleteStaleRefreshTokens = async () => {
    const rows = await db
        .delete(refreshTokens)
        .where(or(lt(refreshTokens.expiresAt, new Date()), lt(refreshTokens.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))))
        .returning({ id: refreshTokens.id });
    return rows.length;
};
//# sourceMappingURL=refresh-token.repository.js.map
import { and, desc, eq, gt, inArray, isNull, ne } from "drizzle-orm";
import { db } from "../db/client.js";
import { adminUsers, recoveryCodes, refreshTokens, } from "../database/schema.js";
export const setTotpSecret = async (userId, encrypted, enabled) => {
    await db
        .update(adminUsers)
        .set({
        totpSecretEnc: encrypted,
        totpEnabled: enabled,
        updatedAt: new Date(),
    })
        .where(eq(adminUsers.id, userId));
};
export const replaceRecoveryCodes = async (userId, hashes) => {
    await db.transaction(async (tx) => {
        await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
        if (hashes.length > 0) {
            await tx
                .insert(recoveryCodes)
                .values(hashes.map((codeHash) => ({ userId, codeHash })));
        }
    });
};
export const findUnusedRecoveryCode = async (userId, codeHash) => {
    const rows = await db
        .select({ id: recoveryCodes.id })
        .from(recoveryCodes)
        .where(and(eq(recoveryCodes.userId, userId), eq(recoveryCodes.codeHash, codeHash), isNull(recoveryCodes.usedAt)))
        .limit(1);
    return rows[0] ?? null;
};
export const markRecoveryCodeUsed = async (id) => {
    await db
        .update(recoveryCodes)
        .set({ usedAt: new Date() })
        .where(eq(recoveryCodes.id, id));
};
export const countUnusedRecoveryCodes = async (userId) => {
    const rows = await db
        .select({ id: recoveryCodes.id })
        .from(recoveryCodes)
        .where(and(eq(recoveryCodes.userId, userId), isNull(recoveryCodes.usedAt)));
    return rows.length;
};
/**
 * One row per refresh-token family (one per login). Only tokens that are still
 * usable are listed; the latest token in the family carries the metadata.
 */
export const listActiveSessions = async (userId) => {
    const rows = await db
        .select({
        id: refreshTokens.id,
        familyId: refreshTokens.familyId,
        userAgent: refreshTokens.userAgent,
        createdAt: refreshTokens.createdAt,
        lastUsedAt: refreshTokens.lastUsedAt,
        expiresAt: refreshTokens.expiresAt,
    })
        .from(refreshTokens)
        .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, new Date())))
        .orderBy(desc(refreshTokens.createdAt));
    const byFamily = new Map();
    for (const row of rows) {
        const existing = byFamily.get(row.familyId);
        if (!existing || row.createdAt > existing.createdAt) {
            byFamily.set(row.familyId, row);
        }
    }
    return [...byFamily.values()];
};
export const revokeSessionFamily = async (userId, familyId) => {
    const rows = await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, userId), eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)))
        .returning({ id: refreshTokens.id });
    return rows.length > 0;
};
export const revokeOtherFamilies = async (userId, keepFamilyId) => {
    const conditions = [
        eq(refreshTokens.userId, userId),
        isNull(refreshTokens.revokedAt),
    ];
    if (keepFamilyId) {
        conditions.push(ne(refreshTokens.familyId, keepFamilyId));
    }
    const rows = await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(...conditions))
        .returning({ id: refreshTokens.id });
    return rows.length;
};
export const touchRefreshToken = async (id) => {
    await db
        .update(refreshTokens)
        .set({ lastUsedAt: new Date() })
        .where(eq(refreshTokens.id, id));
};
/** Used by the socket layer to reject a session whose family was revoked. */
export const activeFamilyExists = async (userId, familyId) => {
    const rows = await db
        .select({ id: refreshTokens.id })
        .from(refreshTokens)
        .where(and(eq(refreshTokens.userId, userId), eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, new Date())))
        .limit(1);
    return rows.length > 0;
};
export const revokeFamiliesByIds = async (userId, families) => {
    if (families.length === 0)
        return;
    await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, userId), inArray(refreshTokens.familyId, families), isNull(refreshTokens.revokedAt)));
};
//# sourceMappingURL=account.repository.js.map
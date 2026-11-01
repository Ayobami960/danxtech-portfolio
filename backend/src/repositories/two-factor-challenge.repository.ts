import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  twoFactorChallenges,
  type TwoFactorChallenge,
} from "../database/schema.js";

export const createTwoFactorChallenge = async (input: {
  userId: string;
  expiresAt: Date;
}): Promise<TwoFactorChallenge> => {
  const rows = await db.insert(twoFactorChallenges).values(input).returning();
  const created = rows[0];
  if (!created) throw new Error("Failed to create a two-factor challenge.");
  return created;
};

export const findTwoFactorChallenge = async (
  id: string,
): Promise<TwoFactorChallenge | null> => {
  const rows = await db
    .select()
    .from(twoFactorChallenges)
    .where(eq(twoFactorChallenges.id, id))
    .limit(1);
  return rows[0] ?? null;
};

/** Single use: the first consume wins, later callers match no row. */
export const consumeTwoFactorChallenge = async (id: string): Promise<void> => {
  await db
    .update(twoFactorChallenges)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(twoFactorChallenges.id, id),
        isNull(twoFactorChallenges.consumedAt),
      ),
    );
};

export const recordTwoFactorFailure = async (
  id: string,
  failedAttempts: number,
): Promise<void> => {
  await db
    .update(twoFactorChallenges)
    .set({ failedAttempts })
    .where(eq(twoFactorChallenges.id, id));
};

/** Any still-pending challenge for this user stops working immediately. */
export const deleteTwoFactorChallengesForUser = async (
  userId: string,
): Promise<void> => {
  await db
    .delete(twoFactorChallenges)
    .where(eq(twoFactorChallenges.userId, userId));
};

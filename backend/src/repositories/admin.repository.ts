import { count, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { adminUsers, type AdminUser } from "../database/schema.js";

export const findAdminByEmail = async (
  email: string,
): Promise<AdminUser | null> => {
  const rows = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);
  return rows[0] ?? null;
};

export const findAdminById = async (
  id: string,
): Promise<AdminUser | null> => {
  const rows = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, id))
    .limit(1);
  return rows[0] ?? null;
};

export const countAdmins = async (): Promise<number> => {
  const rows = await db.select({ value: count() }).from(adminUsers);
  return rows[0]?.value ?? 0;
};

export const createAdmin = async (input: {
  email: string;
  passwordHash: string;
}): Promise<AdminUser> => {
  const rows = await db.insert(adminUsers).values(input).returning();
  const created = rows[0];
  if (!created) throw new Error("Failed to create the admin user.");
  return created;
};

export const recordFailedLogin = async (
  id: string,
  failedAttempts: number,
  lockedUntil: Date | null,
): Promise<void> => {
  await db
    .update(adminUsers)
    .set({ failedAttempts, lockedUntil })
    .where(eq(adminUsers.id, id));
};

export const recordSuccessfulLogin = async (id: string): Promise<void> => {
  await db
    .update(adminUsers)
    .set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(adminUsers.id, id));
};

export const updateAdminPassword = async (
  id: string,
  passwordHash: string,
): Promise<void> => {
  await db
    .update(adminUsers)
    .set({ passwordHash, failedAttempts: 0, lockedUntil: null })
    .where(eq(adminUsers.id, id));
};

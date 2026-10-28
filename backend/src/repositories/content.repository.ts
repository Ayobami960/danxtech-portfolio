import { asc, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  experiences,
  owaspItems,
  securityFocusAreas,
  securityStats,
  skillGroups,
  type NewProject,
} from "../database/schema.js";

/* ---------------------------------- skills --------------------------------- */

export type SkillGroup = typeof skillGroups.$inferSelect;
export type NewSkillGroup = typeof skillGroups.$inferInsert;

export const listSkillGroups = async (): Promise<SkillGroup[]> =>
  db
    .select()
    .from(skillGroups)
    .orderBy(asc(skillGroups.sortOrder), asc(skillGroups.createdAt));

export const findSkillGroup = async (
  id: string,
): Promise<SkillGroup | null> => {
  const rows = await db
    .select()
    .from(skillGroups)
    .where(eq(skillGroups.id, id))
    .limit(1);
  return rows[0] ?? null;
};

export const createSkillGroup = async (
  input: Omit<NewSkillGroup, "id" | "createdAt" | "updatedAt">,
): Promise<SkillGroup> => {
  const rows = await db.insert(skillGroups).values(input).returning();
  const created = rows[0];
  if (!created) throw new Error("Failed to create the skill group.");
  return created;
};

export const updateSkillGroup = async (
  id: string,
  input: Partial<Omit<NewSkillGroup, "id" | "createdAt" | "updatedAt">>,
): Promise<SkillGroup | null> => {
  const rows = await db
    .update(skillGroups)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(skillGroups.id, id))
    .returning();
  return rows[0] ?? null;
};

export const deleteSkillGroup = async (id: string): Promise<void> => {
  await db.delete(skillGroups).where(eq(skillGroups.id, id));
};

export const maxSkillSortOrder = async (): Promise<number> => {
  const rows = await db
    .select({ value: sql<number | null>`max(${skillGroups.sortOrder})` })
    .from(skillGroups);
  return rows[0]?.value ?? -1;
};

export const reorderSkillGroups = async (ids: string[]): Promise<void> => {
  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx
        .update(skillGroups)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(eq(skillGroups.id, id));
    }
  });
};

/* -------------------------------- experience ------------------------------- */

export type Experience = typeof experiences.$inferSelect;
export type NewExperience = typeof experiences.$inferInsert;

export const listExperiences = async (): Promise<Experience[]> =>
  db
    .select()
    .from(experiences)
    .orderBy(asc(experiences.sortOrder), asc(experiences.createdAt));

export const findExperience = async (
  id: string,
): Promise<Experience | null> => {
  const rows = await db
    .select()
    .from(experiences)
    .where(eq(experiences.id, id))
    .limit(1);
  return rows[0] ?? null;
};

export const createExperience = async (
  input: Omit<NewExperience, "id" | "createdAt" | "updatedAt">,
): Promise<Experience> => {
  const rows = await db.insert(experiences).values(input).returning();
  const created = rows[0];
  if (!created) throw new Error("Failed to create the experience.");
  return created;
};

export const updateExperience = async (
  id: string,
  input: Partial<Omit<NewExperience, "id" | "createdAt" | "updatedAt">>,
): Promise<Experience | null> => {
  const rows = await db
    .update(experiences)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(experiences.id, id))
    .returning();
  return rows[0] ?? null;
};

export const deleteExperience = async (id: string): Promise<void> => {
  await db.delete(experiences).where(eq(experiences.id, id));
};

export const maxExperienceSortOrder = async (): Promise<number> => {
  const rows = await db
    .select({ value: sql<number | null>`max(${experiences.sortOrder})` })
    .from(experiences);
  return rows[0]?.value ?? -1;
};

export const reorderExperiences = async (ids: string[]): Promise<void> => {
  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx
        .update(experiences)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(eq(experiences.id, id));
    }
  });
};

/* ------------------------------ security focus ----------------------------- */

export type SecurityFocus = typeof securityFocusAreas.$inferSelect;
export type NewSecurityFocus = typeof securityFocusAreas.$inferInsert;

export const listSecurityFocusAreas = async (): Promise<SecurityFocus[]> =>
  db
    .select()
    .from(securityFocusAreas)
    .orderBy(
      asc(securityFocusAreas.sortOrder),
      asc(securityFocusAreas.createdAt),
    );

export const findSecurityFocus = async (
  id: string,
): Promise<SecurityFocus | null> => {
  const rows = await db
    .select()
    .from(securityFocusAreas)
    .where(eq(securityFocusAreas.id, id))
    .limit(1);
  return rows[0] ?? null;
};

export const createSecurityFocus = async (
  input: Omit<NewSecurityFocus, "id" | "createdAt" | "updatedAt">,
): Promise<SecurityFocus> => {
  const rows = await db.insert(securityFocusAreas).values(input).returning();
  const created = rows[0];
  if (!created) throw new Error("Failed to create the security focus area.");
  return created;
};

export const updateSecurityFocus = async (
  id: string,
  input: Partial<Omit<NewSecurityFocus, "id" | "createdAt" | "updatedAt">>,
): Promise<SecurityFocus | null> => {
  const rows = await db
    .update(securityFocusAreas)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(securityFocusAreas.id, id))
    .returning();
  return rows[0] ?? null;
};

export const deleteSecurityFocus = async (id: string): Promise<void> => {
  await db.delete(securityFocusAreas).where(eq(securityFocusAreas.id, id));
};

export const maxSecurityFocusSortOrder = async (): Promise<number> => {
  const rows = await db
    .select({
      value: sql<number | null>`max(${securityFocusAreas.sortOrder})`,
    })
    .from(securityFocusAreas);
  return rows[0]?.value ?? -1;
};

export const reorderSecurityFocusAreas = async (
  ids: string[],
): Promise<void> => {
  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx
        .update(securityFocusAreas)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(eq(securityFocusAreas.id, id));
    }
  });
};

/* --------------------------------- OWASP ---------------------------------- */

export type OwaspItem = typeof owaspItems.$inferSelect;
export type NewOwaspItem = typeof owaspItems.$inferInsert;

export const listOwaspItems = async (): Promise<OwaspItem[]> =>
  db.select().from(owaspItems).orderBy(asc(owaspItems.sortOrder));

export const findOwaspItem = async (id: string): Promise<OwaspItem | null> => {
  const rows = await db
    .select()
    .from(owaspItems)
    .where(eq(owaspItems.id, id))
    .limit(1);
  return rows[0] ?? null;
};

export const createOwaspItem = async (
  input: Omit<NewOwaspItem, "id">,
): Promise<OwaspItem> => {
  const rows = await db.insert(owaspItems).values(input).returning();
  const created = rows[0];
  if (!created) throw new Error("Failed to create the OWASP item.");
  return created;
};

export const updateOwaspItem = async (
  id: string,
  input: Partial<Omit<NewOwaspItem, "id">>,
): Promise<OwaspItem | null> => {
  const rows = await db
    .update(owaspItems)
    .set(input)
    .where(eq(owaspItems.id, id))
    .returning();
  return rows[0] ?? null;
};

export const deleteOwaspItem = async (id: string): Promise<void> => {
  await db.delete(owaspItems).where(eq(owaspItems.id, id));
};

export const maxOwaspSortOrder = async (): Promise<number> => {
  const rows = await db
    .select({ value: sql<number | null>`max(${owaspItems.sortOrder})` })
    .from(owaspItems);
  return rows[0]?.value ?? -1;
};

export const reorderOwaspItems = async (ids: string[]): Promise<void> => {
  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx
        .update(owaspItems)
        .set({ sortOrder: index })
        .where(eq(owaspItems.id, id));
    }
  });
};

/* ------------------------------ security stats ----------------------------- */

export type SecurityStat = typeof securityStats.$inferSelect;
export type NewSecurityStat = typeof securityStats.$inferInsert;

export const listSecurityStats = async (): Promise<SecurityStat[]> =>
  db.select().from(securityStats).orderBy(asc(securityStats.sortOrder));

export const findSecurityStat = async (
  id: string,
): Promise<SecurityStat | null> => {
  const rows = await db
    .select()
    .from(securityStats)
    .where(eq(securityStats.id, id))
    .limit(1);
  return rows[0] ?? null;
};

export const createSecurityStat = async (
  input: Omit<NewSecurityStat, "id">,
): Promise<SecurityStat> => {
  const rows = await db.insert(securityStats).values(input).returning();
  const created = rows[0];
  if (!created) throw new Error("Failed to create the security stat.");
  return created;
};

export const updateSecurityStat = async (
  id: string,
  input: Partial<Omit<NewSecurityStat, "id">>,
): Promise<SecurityStat | null> => {
  const rows = await db
    .update(securityStats)
    .set(input)
    .where(eq(securityStats.id, id))
    .returning();
  return rows[0] ?? null;
};

export const deleteSecurityStat = async (id: string): Promise<void> => {
  await db.delete(securityStats).where(eq(securityStats.id, id));
};

export const maxSecurityStatSortOrder = async (): Promise<number> => {
  const rows = await db
    .select({ value: sql<number | null>`max(${securityStats.sortOrder})` })
    .from(securityStats);
  return rows[0]?.value ?? -1;
};

export const reorderSecurityStats = async (ids: string[]): Promise<void> => {
  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx
        .update(securityStats)
        .set({ sortOrder: index })
        .where(eq(securityStats.id, id));
    }
  });
};

// Keeps the shared insert type import meaningful for downstream modules.
export type SeedProject = Pick<NewProject, "slug" | "title">;

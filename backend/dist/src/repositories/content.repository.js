import { asc, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { experiences, owaspItems, securityFocusAreas, securityStats, skillGroups, } from "../database/schema.js";
export const listSkillGroups = async () => db
    .select()
    .from(skillGroups)
    .orderBy(asc(skillGroups.sortOrder), asc(skillGroups.createdAt));
export const findSkillGroup = async (id) => {
    const rows = await db
        .select()
        .from(skillGroups)
        .where(eq(skillGroups.id, id))
        .limit(1);
    return rows[0] ?? null;
};
export const createSkillGroup = async (input) => {
    const rows = await db.insert(skillGroups).values(input).returning();
    const created = rows[0];
    if (!created)
        throw new Error("Failed to create the skill group.");
    return created;
};
export const updateSkillGroup = async (id, input) => {
    const rows = await db
        .update(skillGroups)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(skillGroups.id, id))
        .returning();
    return rows[0] ?? null;
};
export const deleteSkillGroup = async (id) => {
    await db.delete(skillGroups).where(eq(skillGroups.id, id));
};
export const maxSkillSortOrder = async () => {
    const rows = await db
        .select({ value: sql `max(${skillGroups.sortOrder})` })
        .from(skillGroups);
    return rows[0]?.value ?? -1;
};
export const reorderSkillGroups = async (ids) => {
    await db.transaction(async (tx) => {
        for (const [index, id] of ids.entries()) {
            await tx
                .update(skillGroups)
                .set({ sortOrder: index, updatedAt: new Date() })
                .where(eq(skillGroups.id, id));
        }
    });
};
export const listExperiences = async () => db
    .select()
    .from(experiences)
    .orderBy(asc(experiences.sortOrder), asc(experiences.createdAt));
export const findExperience = async (id) => {
    const rows = await db
        .select()
        .from(experiences)
        .where(eq(experiences.id, id))
        .limit(1);
    return rows[0] ?? null;
};
export const createExperience = async (input) => {
    const rows = await db.insert(experiences).values(input).returning();
    const created = rows[0];
    if (!created)
        throw new Error("Failed to create the experience.");
    return created;
};
export const updateExperience = async (id, input) => {
    const rows = await db
        .update(experiences)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(experiences.id, id))
        .returning();
    return rows[0] ?? null;
};
export const deleteExperience = async (id) => {
    await db.delete(experiences).where(eq(experiences.id, id));
};
export const maxExperienceSortOrder = async () => {
    const rows = await db
        .select({ value: sql `max(${experiences.sortOrder})` })
        .from(experiences);
    return rows[0]?.value ?? -1;
};
export const reorderExperiences = async (ids) => {
    await db.transaction(async (tx) => {
        for (const [index, id] of ids.entries()) {
            await tx
                .update(experiences)
                .set({ sortOrder: index, updatedAt: new Date() })
                .where(eq(experiences.id, id));
        }
    });
};
export const listSecurityFocusAreas = async () => db
    .select()
    .from(securityFocusAreas)
    .orderBy(asc(securityFocusAreas.sortOrder), asc(securityFocusAreas.createdAt));
export const findSecurityFocus = async (id) => {
    const rows = await db
        .select()
        .from(securityFocusAreas)
        .where(eq(securityFocusAreas.id, id))
        .limit(1);
    return rows[0] ?? null;
};
export const createSecurityFocus = async (input) => {
    const rows = await db.insert(securityFocusAreas).values(input).returning();
    const created = rows[0];
    if (!created)
        throw new Error("Failed to create the security focus area.");
    return created;
};
export const updateSecurityFocus = async (id, input) => {
    const rows = await db
        .update(securityFocusAreas)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(securityFocusAreas.id, id))
        .returning();
    return rows[0] ?? null;
};
export const deleteSecurityFocus = async (id) => {
    await db.delete(securityFocusAreas).where(eq(securityFocusAreas.id, id));
};
export const maxSecurityFocusSortOrder = async () => {
    const rows = await db
        .select({
        value: sql `max(${securityFocusAreas.sortOrder})`,
    })
        .from(securityFocusAreas);
    return rows[0]?.value ?? -1;
};
export const reorderSecurityFocusAreas = async (ids) => {
    await db.transaction(async (tx) => {
        for (const [index, id] of ids.entries()) {
            await tx
                .update(securityFocusAreas)
                .set({ sortOrder: index, updatedAt: new Date() })
                .where(eq(securityFocusAreas.id, id));
        }
    });
};
export const listOwaspItems = async () => db.select().from(owaspItems).orderBy(asc(owaspItems.sortOrder));
export const findOwaspItem = async (id) => {
    const rows = await db
        .select()
        .from(owaspItems)
        .where(eq(owaspItems.id, id))
        .limit(1);
    return rows[0] ?? null;
};
export const createOwaspItem = async (input) => {
    const rows = await db.insert(owaspItems).values(input).returning();
    const created = rows[0];
    if (!created)
        throw new Error("Failed to create the OWASP item.");
    return created;
};
export const updateOwaspItem = async (id, input) => {
    const rows = await db
        .update(owaspItems)
        .set(input)
        .where(eq(owaspItems.id, id))
        .returning();
    return rows[0] ?? null;
};
export const deleteOwaspItem = async (id) => {
    await db.delete(owaspItems).where(eq(owaspItems.id, id));
};
export const maxOwaspSortOrder = async () => {
    const rows = await db
        .select({ value: sql `max(${owaspItems.sortOrder})` })
        .from(owaspItems);
    return rows[0]?.value ?? -1;
};
export const reorderOwaspItems = async (ids) => {
    await db.transaction(async (tx) => {
        for (const [index, id] of ids.entries()) {
            await tx
                .update(owaspItems)
                .set({ sortOrder: index })
                .where(eq(owaspItems.id, id));
        }
    });
};
export const listSecurityStats = async () => db.select().from(securityStats).orderBy(asc(securityStats.sortOrder));
export const findSecurityStat = async (id) => {
    const rows = await db
        .select()
        .from(securityStats)
        .where(eq(securityStats.id, id))
        .limit(1);
    return rows[0] ?? null;
};
export const createSecurityStat = async (input) => {
    const rows = await db.insert(securityStats).values(input).returning();
    const created = rows[0];
    if (!created)
        throw new Error("Failed to create the security stat.");
    return created;
};
export const updateSecurityStat = async (id, input) => {
    const rows = await db
        .update(securityStats)
        .set(input)
        .where(eq(securityStats.id, id))
        .returning();
    return rows[0] ?? null;
};
export const deleteSecurityStat = async (id) => {
    await db.delete(securityStats).where(eq(securityStats.id, id));
};
export const maxSecurityStatSortOrder = async () => {
    const rows = await db
        .select({ value: sql `max(${securityStats.sortOrder})` })
        .from(securityStats);
    return rows[0]?.value ?? -1;
};
export const reorderSecurityStats = async (ids) => {
    await db.transaction(async (tx) => {
        for (const [index, id] of ids.entries()) {
            await tx
                .update(securityStats)
                .set({ sortOrder: index })
                .where(eq(securityStats.id, id));
        }
    });
};
//# sourceMappingURL=content.repository.js.map
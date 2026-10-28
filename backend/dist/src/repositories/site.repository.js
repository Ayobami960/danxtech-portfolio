import { asc, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { aboutContent, credentials, siteSettings, } from "../database/schema.js";
import { ABOUT_ID, SETTINGS_ID } from "../config/constants.js";
/* ---------------------------------- about ---------------------------------- */
export const getAbout = async () => {
    const rows = await db
        .select()
        .from(aboutContent)
        .where(eq(aboutContent.id, ABOUT_ID))
        .limit(1);
    return rows[0] ?? null;
};
export const upsertAbout = async (input) => {
    const rows = await db
        .insert(aboutContent)
        .values({ ...input, id: ABOUT_ID })
        .onConflictDoUpdate({
        target: aboutContent.id,
        set: { ...input, updatedAt: new Date() },
    })
        .returning();
    const saved = rows[0];
    if (!saved)
        throw new Error("Failed to save the about content.");
    return saved;
};
/* -------------------------------- credentials ------------------------------- */
export const listCredentials = async () => db
    .select()
    .from(credentials)
    .orderBy(asc(credentials.kind), asc(credentials.sortOrder), asc(credentials.createdAt));
export const findCredential = async (id) => {
    const rows = await db
        .select()
        .from(credentials)
        .where(eq(credentials.id, id))
        .limit(1);
    return rows[0] ?? null;
};
export const createCredential = async (input) => {
    const rows = await db.insert(credentials).values(input).returning();
    const created = rows[0];
    if (!created)
        throw new Error("Failed to create the credential.");
    return created;
};
export const updateCredential = async (id, input) => {
    const rows = await db
        .update(credentials)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(credentials.id, id))
        .returning();
    return rows[0] ?? null;
};
export const deleteCredential = async (id) => {
    await db.delete(credentials).where(eq(credentials.id, id));
};
export const maxCredentialSortOrder = async () => {
    const rows = await db
        .select({ value: sql `max(${credentials.sortOrder})` })
        .from(credentials);
    return rows[0]?.value ?? -1;
};
export const reorderCredentials = async (ids) => {
    await db.transaction(async (tx) => {
        for (const [index, id] of ids.entries()) {
            await tx
                .update(credentials)
                .set({ sortOrder: index, updatedAt: new Date() })
                .where(eq(credentials.id, id));
        }
    });
};
/* --------------------------------- settings -------------------------------- */
export const getSettings = async () => {
    const rows = await db
        .select()
        .from(siteSettings)
        .where(eq(siteSettings.id, SETTINGS_ID))
        .limit(1);
    return rows[0] ?? null;
};
export const upsertSettings = async (input) => {
    const rows = await db
        .insert(siteSettings)
        .values({ ...input, id: SETTINGS_ID })
        .onConflictDoUpdate({
        target: siteSettings.id,
        set: { ...input, updatedAt: new Date() },
    })
        .returning();
    const saved = rows[0];
    if (!saved)
        throw new Error("Failed to save the site settings.");
    return saved;
};
//# sourceMappingURL=site.repository.js.map
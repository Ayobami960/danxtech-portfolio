import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { aboutContent, credentials, experiences, heroContent, owaspItems, projectImages, projects, securityFocusAreas, securityStats, siteSettings, skillGroups, } from "../database/schema.js";
import { ABOUT_ID, HERO_ID, SETTINGS_ID } from "../config/constants.js";
const externalKey = (path) => `external/${path.replace(/^\/+/, "")}`;
/**
 * Idempotent content seed. Everything runs in one transaction so a partial seed
 * never leaves the site half-populated. The admin account is never created here
 * — that is `npm run admin:create`.
 */
export const seedContent = async (payload) => {
    await db.transaction(async (tx) => {
        await tx
            .insert(heroContent)
            .values({ ...payload.hero, id: HERO_ID })
            .onConflictDoUpdate({
            target: heroContent.id,
            set: { ...payload.hero, updatedAt: new Date() },
        });
        await tx
            .insert(aboutContent)
            .values({ ...payload.about, id: ABOUT_ID })
            .onConflictDoUpdate({
            target: aboutContent.id,
            set: { ...payload.about, updatedAt: new Date() },
        });
        await tx
            .insert(siteSettings)
            .values({ ...payload.settings, id: SETTINGS_ID })
            .onConflictDoUpdate({
            target: siteSettings.id,
            set: { ...payload.settings, updatedAt: new Date() },
        });
        for (const credential of payload.credentials) {
            const { id: _id, ...updatable } = credential;
            await tx
                .insert(credentials)
                .values(credential)
                .onConflictDoUpdate({
                target: credentials.id,
                set: { ...updatable, updatedAt: new Date() },
            });
        }
        // Only one project may be featured (partial unique index). Clear the flag
        // first so re-running the seed can never violate it.
        if (payload.projects.some((project) => project.featured)) {
            await tx.update(projects).set({ featured: false }).where(eq(projects.featured, true));
        }
        for (const project of payload.projects) {
            const { slug: _slug, images = [], ...updatable } = project;
            const rows = await tx
                .insert(projects)
                .values(project)
                .onConflictDoUpdate({
                target: projects.slug,
                set: { ...updatable, updatedAt: new Date() },
            })
                .returning({ id: projects.id });
            const saved = rows[0];
            if (!saved)
                continue;
            for (const [index, image] of images.entries()) {
                await tx
                    .insert(projectImages)
                    .values({
                    projectId: saved.id,
                    url: image,
                    storageKey: externalKey(image),
                    sortOrder: index,
                })
                    .onConflictDoNothing({ target: projectImages.storageKey });
            }
        }
        for (const group of payload.skills) {
            const { id: _id, ...updatable } = group;
            await tx
                .insert(skillGroups)
                .values(group)
                .onConflictDoUpdate({
                target: skillGroups.id,
                set: { ...updatable, updatedAt: new Date() },
            });
        }
        for (const entry of payload.experience) {
            const { id: _id, ...updatable } = entry;
            await tx
                .insert(experiences)
                .values(entry)
                .onConflictDoUpdate({
                target: experiences.id,
                set: { ...updatable, updatedAt: new Date() },
            });
        }
        for (const area of payload.security.focus) {
            const { id: _id, ...updatable } = area;
            await tx
                .insert(securityFocusAreas)
                .values(area)
                .onConflictDoUpdate({
                target: securityFocusAreas.id,
                set: { ...updatable, updatedAt: new Date() },
            });
        }
        // OWASP entries are keyed by their stable code, so an existing row is left
        // exactly as the owner edited it.
        if (payload.security.owasp.length > 0) {
            await tx
                .insert(owaspItems)
                .values(payload.security.owasp)
                .onConflictDoNothing({ target: owaspItems.code });
        }
        for (const stat of payload.security.stats) {
            const { id: _id, ...updatable } = stat;
            await tx
                .insert(securityStats)
                .values(stat)
                .onConflictDoUpdate({ target: securityStats.id, set: updatable });
        }
    });
};
//# sourceMappingURL=seed.repository.js.map
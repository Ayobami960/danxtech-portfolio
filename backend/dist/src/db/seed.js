import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { z } from "zod";
import { closeDatabase } from "./client.js";
import { seedContent } from "../repositories/seed.repository.js";
const SEED_FILE = new URL("../../seed/data.json", import.meta.url);
const hexColor = z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "must be a 6-digit hex colour.");
const text = (max) => z.string().trim().min(1).max(max);
const heroSchema = z
    .object({
    nameParts: z.array(text(30)).min(1).max(4),
    typingPhrases: z.array(text(60)).min(1).max(10),
    intro: z.string().max(400),
    location: z.string().trim().max(100),
    isAvailable: z.boolean(),
    availabilityLabel: text(120),
    stats: z.array(z.object({ value: text(12), label: text(30) }).strict()).max(4),
    socials: z
        .array(z
        .object({
        platform: z.enum(["github", "linkedin", "twitter", "email"]),
        url: z.string().max(2048),
    })
        .strict())
        .max(10),
})
    .strict();
const aboutSchema = z
    .object({
    paragraphs: z.array(text(1200)).min(1).max(6),
    tags: z.array(text(30)).max(12),
    metrics: z.array(z.object({ value: text(10), label: text(40) }).strict()).max(4),
    principles: z
        .array(z
        .object({ icon: text(16), title: text(60), body: text(300) })
        .strict())
        .max(6),
})
    .strict();
const credentialSchema = z
    .object({
    kind: z.enum(["degree", "certification"]),
    title: text(160),
    issuer: z.string().trim().max(160).default(""),
    period: z.string().trim().max(60).nullable().default(null),
    detail: z.string().trim().max(200).nullable().default(null),
})
    .strict();
const settingsSchema = z
    .object({
    contactEmail: z.email().max(255),
    phone: z.string().trim().max(40).default(""),
    location: z.string().trim().max(100).default(""),
})
    .strict();
const projectSchema = z
    .object({
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: z.string().trim().min(2).max(120),
    description: z.string().max(600).default(""),
    icon: z.string().trim().min(1).max(16).default("🚀"),
    accentColor: hexColor.default("#3b82f6"),
    tech: z.array(text(40)).max(15).default([]),
    stats: z.array(text(60)).max(6).default([]),
    liveUrl: z.url().max(2048).nullable().default(null),
    githubUrl: z.url().max(2048).nullable().default(null),
    coverImage: z.string().max(2048).nullable().default(null),
    images: z.array(z.string().max(2048)).default([]),
    featured: z.boolean().default(false),
    published: z.boolean().default(false),
    sortOrder: z.number().int().min(0).max(10_000).default(0),
})
    .strict();
const skillSchema = z
    .object({
    title: text(80),
    icon: text(16).default("🛠️"),
    items: z.array(text(60)).max(40).default([]),
})
    .strict();
const experienceSchema = z
    .object({
    type: z.enum(["engineering", "security"]).default("engineering"),
    role: text(120),
    company: text(120),
    period: text(60),
    isCurrent: z.boolean().default(false),
    color: hexColor.default("#4f8ef7"),
    highlights: z.array(text(500)).max(30).default([]),
})
    .strict();
const focusSchema = z
    .object({
    title: text(120),
    icon: text(16).default("🛡️"),
    color: hexColor.default("#ef4444"),
    description: z.string().max(1000).default(""),
    skills: z.array(text(60)).max(30).default([]),
})
    .strict();
const owaspSchema = z
    .object({
    code: z.string().trim().min(2).max(8).regex(/^[A-Z0-9]+$/),
    name: text(120),
    covered: z.boolean().default(false),
})
    .strict();
const securityStatSchema = z
    .object({
    icon: text(16).default("🔒"),
    label: text(60),
    value: text(20),
})
    .strict();
const seedFileSchema = z
    .object({
    _comment: z.string().optional(),
    hero: heroSchema,
    about: aboutSchema,
    credentials: z.array(credentialSchema).max(50),
    settings: settingsSchema,
    projects: z.array(projectSchema),
    skills: z.array(skillSchema),
    experience: z.array(experienceSchema),
    security: z
        .object({
        focus: z.array(focusSchema),
        owasp: z.array(owaspSchema),
        stats: z.array(securityStatSchema),
    })
        .strict(),
})
    .strict();
/** Stable UUID per natural key so re-running the seed updates instead of duplicating. */
const stableId = (namespace, key) => {
    const hex = createHash("sha256")
        .update(`${namespace}:${key}`)
        .digest("hex")
        .split("");
    hex[12] = "5";
    hex[16] = "8";
    const part = (start, end) => hex.slice(start, end).join("");
    return `${part(0, 8)}-${part(8, 12)}-${part(12, 16)}-${part(16, 20)}-${part(20, 32)}`;
};
const buildPayload = (data) => ({
    hero: {
        nameParts: data.hero.nameParts,
        typingPhrases: data.hero.typingPhrases,
        intro: data.hero.intro,
        location: data.hero.location,
        isAvailable: data.hero.isAvailable,
        availabilityLabel: data.hero.availabilityLabel,
        stats: data.hero.stats,
        socials: data.hero.socials.map((social) => ({
            platform: social.platform,
            url: social.url,
        })),
    },
    about: {
        paragraphs: data.about.paragraphs,
        tags: data.about.tags,
        metrics: data.about.metrics,
        principles: data.about.principles,
    },
    settings: data.settings,
    credentials: data.credentials.map((credential, index) => ({
        id: stableId("credential", `${credential.kind}:${credential.title}`),
        kind: credential.kind,
        title: credential.title,
        issuer: credential.issuer,
        period: credential.period,
        detail: credential.detail,
        sortOrder: index,
    })),
    projects: data.projects.map((project) => ({
        slug: project.slug,
        title: project.title,
        description: project.description,
        icon: project.icon,
        accentColor: project.accentColor,
        tech: project.tech,
        stats: project.stats,
        liveUrl: project.liveUrl,
        githubUrl: project.githubUrl,
        coverImage: project.coverImage,
        images: project.images,
        featured: project.featured,
        published: project.published,
        sortOrder: project.sortOrder,
    })),
    skills: data.skills.map((group, index) => ({
        id: stableId("skill", group.title),
        title: group.title,
        icon: group.icon,
        items: group.items,
        sortOrder: index,
    })),
    experience: data.experience.map((entry, index) => ({
        id: stableId("experience", `${entry.type}:${entry.role}:${entry.company}`),
        type: entry.type,
        role: entry.role,
        company: entry.company,
        period: entry.period,
        isCurrent: entry.isCurrent,
        color: entry.color,
        highlights: entry.highlights,
        sortOrder: index,
    })),
    security: {
        focus: data.security.focus.map((area, index) => ({
            id: stableId("security-focus", area.title),
            title: area.title,
            icon: area.icon,
            color: area.color,
            description: area.description,
            skills: area.skills,
            sortOrder: index,
        })),
        owasp: data.security.owasp.map((item, index) => ({
            id: stableId("owasp", item.code),
            code: item.code,
            name: item.name,
            covered: item.covered,
            sortOrder: index,
        })),
        stats: data.security.stats.map((stat, index) => ({
            id: stableId("security-stat", `${stat.label}:${stat.value}`),
            icon: stat.icon,
            label: stat.label,
            value: stat.value,
            sortOrder: index,
        })),
    },
});
const main = async () => {
    const raw = await readFile(SEED_FILE, "utf8");
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch (error) {
        throw new Error(`seed/data.json is not valid JSON: ${error.message}`, {
            cause: error,
        });
    }
    const result = seedFileSchema.safeParse(parsed);
    if (!result.success) {
        const issues = result.error.issues
            .map((issue) => `  - ${issue.path.join(".") || "seed"}: ${issue.message}`)
            .join("\n");
        throw new Error(`seed/data.json is invalid:\n${issues}`);
    }
    await seedContent(buildPayload(result.data));
    const { data } = result;
    console.log([
        "Seed complete.",
        "  hero:        1 row (upserted)",
        "  about:       1 row (upserted)",
        "  settings:    1 row (upserted)",
        `  credentials: ${data.credentials.length} row(s) (upserted)`,
        `  projects:    ${data.projects.length} row(s) (upserted by slug)`,
        `  skills:      ${data.skills.length} row(s) (upserted)`,
        `  experience:  ${data.experience.length} row(s) (upserted)`,
        `  security:    ${data.security.focus.length} focus area(s), ${data.security.owasp.length} OWASP item(s), ${data.security.stats.length} stat(s)`,
        "No admin user was created. Run `npm run admin:create` for that.",
    ].join("\n"));
};
main()
    .then(async () => {
    await closeDatabase();
})
    .catch(async (error) => {
    console.error(`Seed failed: ${error instanceof Error ? error.message : String(error)}`);
    await closeDatabase().catch(() => undefined);
    process.exitCode = 1;
});
//# sourceMappingURL=seed.js.map
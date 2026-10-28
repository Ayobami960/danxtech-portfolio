import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";

/* ================================================================== */
/* Helpers                                                             */
/* ================================================================== */
const tz = (name: string) => timestamp(name, { withTimezone: true });
const pk = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => tz("created_at").notNull().defaultNow();
const updatedAt = () =>
  tz("updated_at").notNull().defaultNow().$onUpdate(() => new Date());
const textArray = (name: string) =>
  text(name).array().notNull().default(sql`'{}'::text[]`);

/* ================================================================== */
/* Enums                                                               */
/* ================================================================== */
export const messageStatus = pgEnum("message_status", ["unread", "read", "archived"]);
export const experienceType = pgEnum("experience_type", ["engineering", "security"]);

/* ================================================================== */
/* AUTH — single admin (no public sign-up)                             */
/* ================================================================== */
export const adminUsers = pgTable(
  "admin_users",
  {
    id: pk(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: tz("locked_until"),
    lastLoginAt: tz("last_login_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("admin_users_email_lowercase", sql`${t.email} = lower(${t.email})`)]
);


export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  refreshTokens: many(refreshTokens),
  auditLogs: many(auditLogs),
}));


export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    /** All tokens descended from one login share a family — revoke the family on reuse. */
    familyId: uuid("family_id").notNull(),
    /** SHA-256 hex of the token. Never store the raw token. */
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    expiresAt: tz("expires_at").notNull(),
    revokedAt: tz("revoked_at"),
    replacedById: uuid("replaced_by_id"),
    userAgent: text("user_agent"),
    ipHash: varchar("ip_hash", { length: 64 }),
    createdAt: createdAt(),
  },
  (t) => [
    index("refresh_tokens_user_idx").on(t.userId),
    index("refresh_tokens_family_idx").on(t.familyId),
    index("refresh_tokens_expires_idx").on(t.expiresAt),
  ]
);


export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(adminUsers, { fields: [refreshTokens.userId], references: [adminUsers.id] }),
}));

/* ================================================================== */
/* HERO — singleton row (id is always 'hero')                          */
/* ================================================================== */
export type HeroStat = { value: string; label: string };
export type HeroSocial = {
  platform: "github" | "linkedin" | "twitter" | "email";
  url: string;
};

export const heroContent = pgTable(
  "hero_content",
  {
    id: text("id").primaryKey().default("hero"),
    nameParts: textArray("name_parts"), // ["Adetoye", "Daniel", "Kehinde"]
    typingPhrases: textArray("typing_phrases"),
    intro: text("intro").notNull().default(""),
    location: varchar("location", { length: 100 }).notNull().default(""),
    isAvailable: boolean("is_available").notNull().default(true),
    availabilityLabel: varchar("availability_label", { length: 120 })
      .notNull()
      .default("Available for new opportunities"),
    stats: jsonb("stats").$type<HeroStat[]>().notNull().default(sql`'[]'::jsonb`),
    socials: jsonb("socials").$type<HeroSocial[]>().notNull().default(sql`'[]'::jsonb`),
    updatedAt: updatedAt(),
  },
  (t) => [check("hero_content_singleton", sql`${t.id} = 'hero'`)]
);

/* ================================================================== */
/* PROJECTS                                                            */
/* ================================================================== */
export const projects = pgTable("projects", {
  id: pk(),                                   // uuid
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  title: varchar("title", { length: 120 }).notNull(),
  description: text("description").notNull().default(""),
  icon: varchar("icon", { length: 16 }).notNull().default("🚀"),
  accentColor: varchar("accent_color", { length: 7 }).notNull().default("#3b82f6"),
  tech: textArray("tech"),                   
  stats: textArray("stats"),                 
  liveUrl: text("live_url"),                  
  githubUrl: text("github_url"),              
  coverImage: text("cover_image"),            
  coverStorageKey: text("cover_storage_key"),
  featured: boolean("featured").notNull().default(false),
  published: boolean("published").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  index("projects_published_order_idx").on(t.published, t.sortOrder),
  uniqueIndex("projects_single_featured_idx").on(t.featured).where(sql`${t.featured} = true`),
  check("projects_accent_hex", sql`${t.accentColor} ~* '^#[0-9a-f]{6}$'`),
]);

export const projectImages = pgTable("project_images", {
  id: pk(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  storageKey: text("storage_key").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
}, (t) => [index("project_images_project_order_idx").on(t.projectId, t.sortOrder)]);

export const projectsRelations = relations(projects, ({ many }) => ({
  images: many(projectImages),
}));


export const projectImagesRelations = relations(projectImages, ({ one }) => ({
  project: one(projects, { fields: [projectImages.projectId], references: [projects.id] }),
}));

/* ================================================================== */
/* CONTACT                                                             */
/* ================================================================== */
export const contactMessages = pgTable(
  "contact_messages",
  {
    id: pk(),
    name: varchar("name", { length: 80 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 120 }),
    message: text("message").notNull(),
    status: messageStatus("status").notNull().default("unread"),
    starred: boolean("starred").notNull().default(false),
    isSpam: boolean("is_spam").notNull().default(false),
    /** sha256(email + normalized message) — used to reject duplicates within 10 min. */
    messageHash: varchar("message_hash", { length: 64 }).notNull(),
    /** Salted hash, never the raw IP. */
    ipHash: varchar("ip_hash", { length: 64 }).notNull(),
    userAgent: text("user_agent"),
    /** Set only when the owner notification email was actually sent. */
    notifiedAt: tz("notified_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("contact_status_created_idx").on(t.status, t.createdAt),
    index("contact_dedupe_idx").on(t.email, t.messageHash, t.createdAt),
    index("contact_created_idx").on(t.createdAt),
  ]
);

/* ================================================================== */
/* RESUME — singleton row (id is always 'resume'); replace = upsert    */
/* ================================================================== */
export const resumes = pgTable(
  "resumes",
  {
    id: text("id").primaryKey().default("resume"),
    storageKey: text("storage_key").notNull(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull().default("application/pdf"),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    downloadCount: integer("download_count").notNull().default(0),
    uploadedAt: tz("uploaded_at").notNull().defaultNow(),
    updatedAt: updatedAt(),
  },
  (t) => [check("resumes_singleton", sql`${t.id} = 'resume'`)]
);


export const auditLogs = pgTable(
  "audit_logs",
  {
    id: pk(),
    userId: uuid("user_id").references(() => adminUsers.id, { onDelete: "set null" }),
    action: varchar("action", { length: 80 }).notNull(), // e.g. "project.update"
    entity: varchar("entity", { length: 60 }).notNull(), // e.g. "project"
    entityId: text("entity_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    ipHash: varchar("ip_hash", { length: 64 }),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_created_idx").on(t.createdAt),
    index("audit_entity_idx").on(t.entity, t.entityId),
  ]
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(adminUsers, { fields: [auditLogs.userId], references: [adminUsers.id] }),
}));


/* ================================================================== */
/* OPTIONAL CONTENT MODULES                                            */
/* Skills / Experience / Security are static in lib/data.ts today.     */
/* Keep these tables to make them dynamic too; delete them otherwise.  */
/* ================================================================== */
export const skillGroups = pgTable("skill_groups", {
  id: pk(),
  title: varchar("title", { length: 80 }).notNull(),
  icon: varchar("icon", { length: 16 }).notNull().default("🛠️"),
  items: textArray("items"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const experiences = pgTable(
  "experiences",
  {
    id: pk(),
    type: experienceType("type").notNull().default("engineering"),
    role: varchar("role", { length: 120 }).notNull(),
    company: varchar("company", { length: 120 }).notNull(),
    period: varchar("period", { length: 60 }).notNull(), // "2023 – Present"
    isCurrent: boolean("is_current").notNull().default(false),
    color: varchar("color", { length: 7 }).notNull().default("#4f8ef7"),
    highlights: textArray("highlights"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("experiences_order_idx").on(t.sortOrder)]
);

export const securityFocusAreas = pgTable("security_focus_areas", {
  id: pk(),
  title: varchar("title", { length: 120 }).notNull(),
  icon: varchar("icon", { length: 16 }).notNull().default("🛡️"),
  color: varchar("color", { length: 7 }).notNull().default("#ef4444"),
  description: text("description").notNull().default(""),
  skills: textArray("skills"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const owaspItems = pgTable("owasp_items", {
  id: pk(),
  code: varchar("code", { length: 8 }).notNull().unique(), // "A01"
  name: varchar("name", { length: 120 }).notNull(),
  covered: boolean("covered").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const securityStats = pgTable("security_stats", {
  id: pk(),
  icon: varchar("icon", { length: 16 }).notNull().default("🔒"),
  label: varchar("label", { length: 60 }).notNull(),
  value: varchar("value", { length: 20 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});








export type AdminUser = typeof adminUsers.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type HeroContent = typeof heroContent.$inferSelect;
export type NewHeroContent = typeof heroContent.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectImage = typeof projectImages.$inferSelect;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type NewContactMessage = typeof contactMessages.$inferInsert;
export type Resume = typeof resumes.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
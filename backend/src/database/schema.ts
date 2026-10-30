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
  bigint,
  index,
  uniqueIndex,
  check,
  customType,
} from "drizzle-orm/pg-core";

/** PostgreSQL `bytea` (the resume PDF lives in the database, not in ImageKit). */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

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
export const credentialKind = pgEnum("credential_kind", ["degree", "certification"]);
export const conversationStatus = pgEnum("conversation_status", [
  "new",
  "open",
  "closed",
  "archived",
]);
export const chatSender = pgEnum("chat_sender", ["visitor", "admin", "system"]);

/* ================================================================== */
/* AUTH — single admin (no public sign-up)                             */
/* ================================================================== */
export const adminUsers = pgTable(
  "admin_users",
  {
    id: pk(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    /** AES-256-GCM encrypted TOTP secret. Never returned by the API. */
    totpSecretEnc: text("totp_secret_enc"),
    totpEnabled: boolean("totp_enabled").notNull().default(false),
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
    lastUsedAt: tz("last_used_at"),
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

export const recoveryCodes = pgTable(
  "recovery_codes",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    /** SHA-256 hex of the single-use code. */
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    usedAt: tz("used_at"),
    createdAt: createdAt(),
  },
  (t) => [index("recovery_codes_user_idx").on(t.userId)]
);

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
/* ABOUT — singleton row (id is always 'about')                        */
/* ================================================================== */
export type AboutMetric = { value: string; label: string };
export type AboutPrinciple = { icon: string; title: string; body: string };

export const aboutContent = pgTable(
  "about_content",
  {
    id: text("id").primaryKey().default("about"),
    paragraphs: textArray("paragraphs"),
    tags: textArray("tags"),
    metrics: jsonb("metrics").$type<AboutMetric[]>().notNull().default(sql`'[]'::jsonb`),
    principles: jsonb("principles")
      .$type<AboutPrinciple[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    updatedAt: updatedAt(),
  },
  (t) => [check("about_content_singleton", sql`${t.id} = 'about'`)]
);

/* ================================================================== */
/* CREDENTIALS — education + certifications                            */
/* ================================================================== */
export const credentials = pgTable(
  "credentials",
  {
    id: pk(),
    kind: credentialKind("kind").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    issuer: varchar("issuer", { length: 160 }).notNull().default(""),
    period: varchar("period", { length: 60 }),
    detail: text("detail"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("credentials_kind_order_idx").on(t.kind, t.sortOrder)]
);

/* ================================================================== */
/* SITE SETTINGS — singleton row (id is always 'site')                 */
/* ================================================================== */
export const siteSettings = pgTable(
  "site_settings",
  {
    id: text("id").primaryKey().default("site"),
    contactEmail: varchar("contact_email", { length: 255 }).notNull().default(""),
    phone: varchar("phone", { length: 40 }).notNull().default(""),
    location: varchar("location", { length: 100 }).notNull().default(""),
    updatedAt: updatedAt(),
  },
  (t) => [check("site_settings_singleton", sql`${t.id} = 'site'`)]
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
  /** ImageKit fileId for coverImage; needed to delete it without a lookup. */
  coverFileId: text("cover_file_id"),
  coverStorageKey: text("cover_storage_key"),
  coverOriginalName: varchar("cover_original_name", { length: 255 }),
  coverMimeType: varchar("cover_mime_type", { length: 100 }),
  coverSizeBytes: integer("cover_size_bytes"),
  coverSha256: varchar("cover_sha256", { length: 64 }),
  /** Optional PDF (case study) attached to the project. */
  documentUrl: text("document_url"),
  /** ImageKit fileId for documentUrl; needed to delete it without a lookup. */
  documentFileId: text("document_file_id"),
  documentStorageKey: text("document_storage_key"),
  documentName: varchar("document_name", { length: 255 }),
  documentSizeBytes: integer("document_size_bytes"),
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
  /** ImageKit fileId; needed to delete it without a lookup. */
  fileId: text("file_id"),
  storageKey: text("storage_key").notNull().unique(),
  originalName: varchar("original_name", { length: 255 }),
  mimeType: varchar("mime_type", { length: 100 }),
  sizeBytes: integer("size_bytes"),
  sha256: varchar("sha256", { length: 64 }),
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
/* LIVE CHAT — conversations + messages                                */
/* ================================================================== */
export const conversations = pgTable(
  "conversations",
  {
    id: pk(),
    contactMessageId: uuid("contact_message_id").references(
      () => contactMessages.id,
      { onDelete: "set null" },
    ),
    visitorName: varchar("visitor_name", { length: 80 }).notNull(),
    visitorEmail: varchar("visitor_email", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 120 }),
    status: conversationStatus("status").notNull().default("new"),
    starred: boolean("starred").notNull().default(false),
    isSpam: boolean("is_spam").notNull().default(false),
    unreadForAdmin: integer("unread_for_admin").notNull().default(0),
    unreadForVisitor: integer("unread_for_visitor").notNull().default(0),
    lastMessageAt: tz("last_message_at").notNull().defaultNow(),
    lastMessagePreview: varchar("last_message_preview", { length: 160 })
      .notNull()
      .default(""),
    visitorLastSeenAt: tz("visitor_last_seen_at"),
    adminLastSeenAt: tz("admin_last_seen_at"),
    inviteTokenHash: varchar("invite_token_hash", { length: 64 }).unique(),
    inviteExpiresAt: tz("invite_expires_at"),
    inviteSentAt: tz("invite_sent_at"),
    inviteRevokedAt: tz("invite_revoked_at"),
    /** Set the first time the visitor passes email + OTP verification. */
    visitorVerifiedAt: tz("visitor_verified_at"),
    ownerEmailedAt: tz("owner_emailed_at"),
    visitorEmailedAt: tz("visitor_emailed_at"),
    ipHash: varchar("ip_hash", { length: 64 }).notNull(),
    closedAt: tz("closed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("conversations_status_last_idx").on(t.status, t.lastMessageAt),
    index("conversations_email_idx").on(t.visitorEmail),
  ]
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: pk(),
    seq: bigint("seq", { mode: "number" }).generatedAlwaysAsIdentity(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    sender: chatSender("sender").notNull(),
    body: text("body").notNull(),
    clientMsgId: varchar("client_msg_id", { length: 36 }),
    /** ImageKit key for an image attachment; the URL is built by the driver. */
    imageKey: text("image_key"),
    imageMimeType: varchar("image_mime_type", { length: 100 }),
    deliveredAt: tz("delivered_at"),
    readAt: tz("read_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("chat_messages_idempotency_idx")
      .on(t.conversationId, t.clientMsgId)
      .where(sql`${t.clientMsgId} is not null`),
    index("chat_messages_conv_seq_idx").on(t.conversationId, t.seq),
    // A message is either text, an image, or both.
    check(
      "chat_messages_body_len",
      sql`char_length(${t.body}) between 0 and 2000 and (char_length(${t.body}) >= 1 or ${t.imageKey} is not null)`,
    ),
  ]
);

/** One-time codes that prove the visitor owns the email on the conversation. */
export const chatVerificationCodes = pgTable(
  "chat_verification_codes",
  {
    id: pk(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    /** Lowercased address the code was sent to. */
    email: varchar("email", { length: 255 }).notNull(),
    /** HMAC-SHA256 hex of the code. The code itself is never stored or logged. */
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: tz("expires_at").notNull(),
    consumedAt: tz("consumed_at"),
    createdAt: createdAt(),
  },
  (t) => [index("chat_verification_conversation_idx").on(t.conversationId)],
);

/* ================================================================== */
/* RESUME — singleton row (id is always 'resume'); replace = upsert    */
/* ================================================================== */
export const resumes = pgTable(
  "resumes",
  {
    id: text("id").primaryKey().default("resume"),
    /**
     * Cloudinary delivery URL (`secure_url`) returned by the signed upload.
     * Null on legacy rows that still keep their bytes in `data`.
     */
    url: text("url"),
    /** Cloudinary public_id, used to delete the object through the API. */
    publicId: text("public_id"),
    /** Legacy bytes path: kept nullable so a Cloudinary row stores metadata only. */
    data: bytea("data"),
    /** Legacy ImageKit key; only set on rows uploaded before the move. */
    storageKey: text("storage_key"),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull().default("application/pdf"),
    /** Null for Cloudinary-hosted rows: Cloudinary reports the real size. */
    sizeBytes: integer("size_bytes"),
    sha256: varchar("sha256", { length: 64 }),
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
  color: varchar("color", { length: 7 }).notNull().default("#4f8ef7"),
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
export type ProjectCoverMetadata = {
  originalName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  sha256: string | null;
};
export type NewProject = typeof projects.$inferInsert;
export type ProjectImage = typeof projectImages.$inferSelect;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type NewContactMessage = typeof contactMessages.$inferInsert;
export type Resume = typeof resumes.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type AboutContent = typeof aboutContent.$inferSelect;
export type Credential = typeof credentials.$inferSelect;
export type SiteSettings = typeof siteSettings.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type ChatVerificationCode = typeof chatVerificationCodes.$inferSelect;
export type RecoveryCode = typeof recoveryCodes.$inferSelect;
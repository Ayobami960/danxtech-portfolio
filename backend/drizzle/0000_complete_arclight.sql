CREATE TYPE "public"."chat_sender" AS ENUM('visitor', 'admin', 'system');--> statement-breakpoint
CREATE TYPE "public"."conversation_status" AS ENUM('new', 'open', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."credential_kind" AS ENUM('degree', 'certification');--> statement-breakpoint
CREATE TYPE "public"."experience_type" AS ENUM('engineering', 'security');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('unread', 'read', 'archived');--> statement-breakpoint
CREATE TABLE "about_content" (
	"id" text PRIMARY KEY DEFAULT 'about' NOT NULL,
	"paragraphs" text[] DEFAULT '{}'::text[] NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"metrics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"principles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "about_content_singleton" CHECK ("about_content"."id" = 'about')
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"totp_secret_enc" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email"),
	CONSTRAINT "admin_users_email_lowercase" CHECK ("admin_users"."email" = lower("admin_users"."email"))
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(80) NOT NULL,
	"entity" varchar(60) NOT NULL,
	"entity_id" text,
	"meta" jsonb,
	"ip_hash" varchar(64),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "chat_messages_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"conversation_id" uuid NOT NULL,
	"sender" "chat_sender" NOT NULL,
	"body" text NOT NULL,
	"client_msg_id" varchar(36),
	"image_key" text,
	"image_mime_type" varchar(100),
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_messages_body_len" CHECK (char_length("chat_messages"."body") between 0 and 2000 and (char_length("chat_messages"."body") >= 1 or "chat_messages"."image_key" is not null))
);
--> statement-breakpoint
CREATE TABLE "chat_verification_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(80) NOT NULL,
	"email" varchar(255) NOT NULL,
	"subject" varchar(120),
	"message" text NOT NULL,
	"status" "message_status" DEFAULT 'unread' NOT NULL,
	"starred" boolean DEFAULT false NOT NULL,
	"is_spam" boolean DEFAULT false NOT NULL,
	"message_hash" varchar(64) NOT NULL,
	"ip_hash" varchar(64) NOT NULL,
	"user_agent" text,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_message_id" uuid,
	"visitor_name" varchar(80) NOT NULL,
	"visitor_email" varchar(255) NOT NULL,
	"subject" varchar(120),
	"status" "conversation_status" DEFAULT 'new' NOT NULL,
	"starred" boolean DEFAULT false NOT NULL,
	"is_spam" boolean DEFAULT false NOT NULL,
	"unread_for_admin" integer DEFAULT 0 NOT NULL,
	"unread_for_visitor" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_preview" varchar(160) DEFAULT '' NOT NULL,
	"visitor_last_seen_at" timestamp with time zone,
	"admin_last_seen_at" timestamp with time zone,
	"invite_token_hash" varchar(64),
	"invite_expires_at" timestamp with time zone,
	"invite_sent_at" timestamp with time zone,
	"invite_revoked_at" timestamp with time zone,
	"visitor_verified_at" timestamp with time zone,
	"owner_emailed_at" timestamp with time zone,
	"visitor_emailed_at" timestamp with time zone,
	"ip_hash" varchar(64) NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_invite_token_hash_unique" UNIQUE("invite_token_hash")
);
--> statement-breakpoint
CREATE TABLE "credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "credential_kind" NOT NULL,
	"title" varchar(160) NOT NULL,
	"issuer" varchar(160) DEFAULT '' NOT NULL,
	"period" varchar(60),
	"detail" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "experience_type" DEFAULT 'engineering' NOT NULL,
	"role" varchar(120) NOT NULL,
	"company" varchar(120) NOT NULL,
	"period" varchar(60) NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"color" varchar(7) DEFAULT '#4f8ef7' NOT NULL,
	"highlights" text[] DEFAULT '{}'::text[] NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hero_content" (
	"id" text PRIMARY KEY DEFAULT 'hero' NOT NULL,
	"name_parts" text[] DEFAULT '{}'::text[] NOT NULL,
	"typing_phrases" text[] DEFAULT '{}'::text[] NOT NULL,
	"intro" text DEFAULT '' NOT NULL,
	"location" varchar(100) DEFAULT '' NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"availability_label" varchar(120) DEFAULT 'Available for new opportunities' NOT NULL,
	"stats" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"socials" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hero_content_singleton" CHECK ("hero_content"."id" = 'hero')
);
--> statement-breakpoint
CREATE TABLE "owasp_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(8) NOT NULL,
	"name" varchar(120) NOT NULL,
	"covered" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "owasp_items_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "project_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"url" text NOT NULL,
	"storage_key" text NOT NULL,
	"original_name" varchar(255),
	"mime_type" varchar(100),
	"size_bytes" integer,
	"sha256" varchar(64),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_images_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"title" varchar(120) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" varchar(16) DEFAULT '🚀' NOT NULL,
	"accent_color" varchar(7) DEFAULT '#3b82f6' NOT NULL,
	"tech" text[] DEFAULT '{}'::text[] NOT NULL,
	"stats" text[] DEFAULT '{}'::text[] NOT NULL,
	"live_url" text,
	"github_url" text,
	"cover_image" text,
	"cover_storage_key" text,
	"cover_original_name" varchar(255),
	"cover_mime_type" varchar(100),
	"cover_size_bytes" integer,
	"cover_sha256" varchar(64),
	"featured" boolean DEFAULT false NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug"),
	CONSTRAINT "projects_accent_hex" CHECK ("projects"."accent_color" ~* '^#[0-9a-f]{6}$')
);
--> statement-breakpoint
CREATE TABLE "recovery_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"replaced_by_id" uuid,
	"user_agent" text,
	"ip_hash" varchar(64),
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "resumes" (
	"id" text PRIMARY KEY DEFAULT 'resume' NOT NULL,
	"data" "bytea",
	"storage_key" text,
	"original_name" varchar(255) NOT NULL,
	"mime_type" varchar(100) DEFAULT 'application/pdf' NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"download_count" integer DEFAULT 0 NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resumes_singleton" CHECK ("resumes"."id" = 'resume')
);
--> statement-breakpoint
CREATE TABLE "security_focus_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(120) NOT NULL,
	"icon" varchar(16) DEFAULT '🛡️' NOT NULL,
	"color" varchar(7) DEFAULT '#ef4444' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"icon" varchar(16) DEFAULT '🔒' NOT NULL,
	"label" varchar(60) NOT NULL,
	"value" varchar(20) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" text PRIMARY KEY DEFAULT 'site' NOT NULL,
	"contact_email" varchar(255) DEFAULT '' NOT NULL,
	"phone" varchar(40) DEFAULT '' NOT NULL,
	"location" varchar(100) DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_settings_singleton" CHECK ("site_settings"."id" = 'site')
);
--> statement-breakpoint
CREATE TABLE "skill_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(80) NOT NULL,
	"icon" varchar(16) DEFAULT '🛠️' NOT NULL,
	"items" text[] DEFAULT '{}'::text[] NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_verification_codes" ADD CONSTRAINT "chat_verification_codes_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_message_id_contact_messages_id_fk" FOREIGN KEY ("contact_message_id") REFERENCES "public"."contact_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_images" ADD CONSTRAINT "project_images_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_codes" ADD CONSTRAINT "recovery_codes_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_admin_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_idempotency_idx" ON "chat_messages" USING btree ("conversation_id","client_msg_id") WHERE "chat_messages"."client_msg_id" is not null;--> statement-breakpoint
CREATE INDEX "chat_messages_conv_seq_idx" ON "chat_messages" USING btree ("conversation_id","seq");--> statement-breakpoint
CREATE INDEX "chat_verification_conversation_idx" ON "chat_verification_codes" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "contact_status_created_idx" ON "contact_messages" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "contact_dedupe_idx" ON "contact_messages" USING btree ("email","message_hash","created_at");--> statement-breakpoint
CREATE INDEX "contact_created_idx" ON "contact_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "conversations_status_last_idx" ON "conversations" USING btree ("status","last_message_at");--> statement-breakpoint
CREATE INDEX "conversations_email_idx" ON "conversations" USING btree ("visitor_email");--> statement-breakpoint
CREATE INDEX "credentials_kind_order_idx" ON "credentials" USING btree ("kind","sort_order");--> statement-breakpoint
CREATE INDEX "experiences_order_idx" ON "experiences" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "project_images_project_order_idx" ON "project_images" USING btree ("project_id","sort_order");--> statement-breakpoint
CREATE INDEX "projects_published_order_idx" ON "projects" USING btree ("published","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_single_featured_idx" ON "projects" USING btree ("featured") WHERE "projects"."featured" = true;--> statement-breakpoint
CREATE INDEX "recovery_codes_user_idx" ON "recovery_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_family_idx" ON "refresh_tokens" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_expires_idx" ON "refresh_tokens" USING btree ("expires_at");
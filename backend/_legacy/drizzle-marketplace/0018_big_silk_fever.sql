CREATE TABLE "agency_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"professional_title" text,
	"size" text NOT NULL,
	"specialty" text NOT NULL,
	"website" text,
	"overview" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"avatar_image" jsonb,
	"is_onboarded" boolean DEFAULT false NOT NULL,
	"stripe_connect_account_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agency_metadata_owner_id_unique" UNIQUE("owner_id")
);
--> statement-breakpoint
ALTER TABLE "connects" ALTER COLUMN "freelancer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "connects" ADD COLUMN "agency_id" uuid;--> statement-breakpoint
ALTER TABLE "agency_metadata" ADD CONSTRAINT "agency_metadata_owner_id_accounts_auth_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."accounts"("auth_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connects" ADD CONSTRAINT "connects_agency_id_agency_metadata_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agency_metadata"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connects" ADD CONSTRAINT "connects_agency_id_unique" UNIQUE("agency_id");--> statement-breakpoint
ALTER TABLE "connects" ADD CONSTRAINT "connects_owner_check" CHECK (("connects"."freelancer_id" IS NOT NULL) <> ("connects"."agency_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_unread_count_check" CHECK ("conversation_participants"."unread_count" >= 0);--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_file_size_check" CHECK ("message_attachments"."file_size" >= 0);--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_content_check" CHECK ("messages"."message_type" = 'USER' OR ("messages"."message_type" = 'SYSTEM_EVENT' AND "messages"."event_type" IS NOT NULL));
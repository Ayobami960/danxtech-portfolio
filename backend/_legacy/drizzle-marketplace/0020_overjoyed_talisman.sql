CREATE TYPE "public"."contract_milestone_status" AS ENUM('PENDING', 'ACTIVE', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('PENDING', 'ACTIVE', 'COMPLETED');--> statement-breakpoint
CREATE TABLE "agency_earning" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"total_earning" numeric(12, 2) DEFAULT '0' NOT NULL,
	"completed_jobs" integer DEFAULT 0 NOT NULL,
	"ongoing_jobs" integer DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"job_success_score" numeric(5, 2) DEFAULT '0' NOT NULL,
	"rating" numeric(3, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agency_earning_agency_id_unique" UNIQUE("agency_id"),
	CONSTRAINT "agency_earning_total_check" CHECK ("agency_earning"."total_earning" >= 0),
	CONSTRAINT "agency_earning_completed_check" CHECK ("agency_earning"."completed_jobs" >= 0),
	CONSTRAINT "agency_earning_ongoing_check" CHECK ("agency_earning"."ongoing_jobs" >= 0),
	CONSTRAINT "agency_earning_reviews_check" CHECK ("agency_earning"."review_count" >= 0),
	CONSTRAINT "agency_earning_success_check" CHECK ("agency_earning"."job_success_score" BETWEEN 0 AND 100),
	CONSTRAINT "agency_earning_rating_check" CHECK ("agency_earning"."rating" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE TABLE "agency_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'Agency member' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"invited_by" text NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agency_portfolios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agency_id" uuid NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"live_url" text,
	"cover_image" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_spents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" text NOT NULL,
	"total_spent" numeric(12, 2) DEFAULT '0' NOT NULL,
	"completed_contracts" integer DEFAULT 0 NOT NULL,
	"ongoing_contracts" integer DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"rating" numeric(3, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "client_spents_client_id_unique" UNIQUE("client_id"),
	CONSTRAINT "client_spents_total_check" CHECK ("client_spents"."total_spent" >= 0),
	CONSTRAINT "client_spents_completed_check" CHECK ("client_spents"."completed_contracts" >= 0),
	CONSTRAINT "client_spents_ongoing_check" CHECK ("client_spents"."ongoing_contracts" >= 0),
	CONSTRAINT "client_spents_reviews_check" CHECK ("client_spents"."review_count" >= 0),
	CONSTRAINT "client_spents_rating_check" CHECK ("client_spents"."rating" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE TABLE "contract_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"title" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"due_date" date NOT NULL,
	"position" integer NOT NULL,
	"status" "contract_milestone_status" DEFAULT 'PENDING' NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"funded_at" timestamp with time zone,
	"payment_requested_at" timestamp with time zone,
	"submission_message" text,
	"submission_delivery_link" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contract_milestones_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id"),
	CONSTRAINT "contract_milestones_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id"),
	CONSTRAINT "contract_milestones_amount_check" CHECK ("contract_milestones"."amount" > 0),
	CONSTRAINT "contract_milestones_position_check" CHECK ("contract_milestones"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"freelancer_id" text,
	"agency_id" uuid,
	"title" text NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"status" "contract_status" DEFAULT 'PENDING' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contracts_total_amount_check" CHECK ("contracts"."total_amount" > 0),
	CONSTRAINT "contracts_owner_check" CHECK (("contracts"."freelancer_id" IS NOT NULL) <> ("contracts"."agency_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "earning_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"freelancer_id" text,
	"agency_id" uuid,
	"contract_id" uuid NOT NULL,
	"milestone_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"platform_fee_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "earning_history_milestone_id_unique" UNIQUE("milestone_id"),
	CONSTRAINT "earning_history_amount_check" CHECK ("earning_history"."amount" > 0),
	CONSTRAINT "earning_history_fee_check" CHECK ("earning_history"."platform_fee_amount" >= 0),
	CONSTRAINT "earning_history_owner_check" CHECK (("earning_history"."freelancer_id" IS NOT NULL) <> ("earning_history"."agency_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "freelancer_earning" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"freelancer_id" text NOT NULL,
	"total_earning" numeric(12, 2) DEFAULT '0' NOT NULL,
	"completed_jobs" integer DEFAULT 0 NOT NULL,
	"ongoing_jobs" integer DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"job_success_score" numeric(5, 2) DEFAULT '0' NOT NULL,
	"rating" numeric(3, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "freelancer_earning_freelancer_id_unique" UNIQUE("freelancer_id"),
	CONSTRAINT "freelancer_earning_total_check" CHECK ("freelancer_earning"."total_earning" >= 0),
	CONSTRAINT "freelancer_earning_completed_check" CHECK ("freelancer_earning"."completed_jobs" >= 0),
	CONSTRAINT "freelancer_earning_ongoing_check" CHECK ("freelancer_earning"."ongoing_jobs" >= 0),
	CONSTRAINT "freelancer_earning_reviews_check" CHECK ("freelancer_earning"."review_count" >= 0),
	CONSTRAINT "freelancer_earning_success_check" CHECK ("freelancer_earning"."job_success_score" BETWEEN 0 AND 100),
	CONSTRAINT "freelancer_earning_rating_check" CHECK ("freelancer_earning"."rating" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"message_id" uuid,
	"provider" text DEFAULT 'daily' NOT NULL,
	"provider_room_name" text NOT NULL,
	"join_url" text NOT NULL,
	"started_by_account_id" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meetings_status_check" CHECK ("meetings"."status" IN ('ACTIVE', 'ENDED'))
);
--> statement-breakpoint
CREATE TABLE "payout_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"freelancer_id" text,
	"agency_id" uuid,
	"earning_history_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"stripe_transfer_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payout_history_earning_history_id_unique" UNIQUE("earning_history_id"),
	CONSTRAINT "payout_history_stripe_transfer_id_unique" UNIQUE("stripe_transfer_id"),
	CONSTRAINT "payout_history_amount_check" CHECK ("payout_history"."amount" > 0),
	CONSTRAINT "payout_history_owner_check" CHECK (("payout_history"."freelancer_id" IS NOT NULL) <> ("payout_history"."agency_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"reviewer_id" text NOT NULL,
	"reviewee_id" text NOT NULL,
	"agency_id" uuid,
	"rating" integer NOT NULL,
	"comment" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_rating_check" CHECK ("reviews"."rating" BETWEEN 1 AND 5),
	CONSTRAINT "reviews_different_accounts_check" CHECK ("reviews"."reviewer_id" <> "reviews"."reviewee_id")
);
--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "recipient_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "stripe_connect_account_id" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "agency_id" uuid;--> statement-breakpoint
ALTER TABLE "agency_earning" ADD CONSTRAINT "agency_earning_agency_id_agency_metadata_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agency_metadata"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_invitations" ADD CONSTRAINT "agency_invitations_agency_id_agency_metadata_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agency_metadata"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_invitations" ADD CONSTRAINT "agency_invitations_invited_by_accounts_auth_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."accounts"("auth_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agency_portfolios" ADD CONSTRAINT "agency_portfolios_agency_id_agency_metadata_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agency_metadata"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_spents" ADD CONSTRAINT "client_spents_client_id_accounts_auth_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."accounts"("auth_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_milestones" ADD CONSTRAINT "contract_milestones_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_job_id_job_posts_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job_posts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_client_id_accounts_auth_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."accounts"("auth_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_freelancer_id_accounts_auth_id_fk" FOREIGN KEY ("freelancer_id") REFERENCES "public"."accounts"("auth_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_agency_id_agency_metadata_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agency_metadata"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earning_history" ADD CONSTRAINT "earning_history_freelancer_id_accounts_auth_id_fk" FOREIGN KEY ("freelancer_id") REFERENCES "public"."accounts"("auth_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earning_history" ADD CONSTRAINT "earning_history_agency_id_agency_metadata_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agency_metadata"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earning_history" ADD CONSTRAINT "earning_history_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "earning_history" ADD CONSTRAINT "earning_history_milestone_id_contract_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."contract_milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "freelancer_earning" ADD CONSTRAINT "freelancer_earning_freelancer_id_accounts_auth_id_fk" FOREIGN KEY ("freelancer_id") REFERENCES "public"."accounts"("auth_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_started_by_account_id_accounts_auth_id_fk" FOREIGN KEY ("started_by_account_id") REFERENCES "public"."accounts"("auth_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_history" ADD CONSTRAINT "payout_history_freelancer_id_accounts_auth_id_fk" FOREIGN KEY ("freelancer_id") REFERENCES "public"."accounts"("auth_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_history" ADD CONSTRAINT "payout_history_agency_id_agency_metadata_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agency_metadata"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_history" ADD CONSTRAINT "payout_history_earning_history_id_earning_history_id_fk" FOREIGN KEY ("earning_history_id") REFERENCES "public"."earning_history"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_accounts_auth_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."accounts"("auth_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewee_id_accounts_auth_id_fk" FOREIGN KEY ("reviewee_id") REFERENCES "public"."accounts"("auth_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_agency_id_agency_metadata_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agency_metadata"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agency_invitations_email_status_idx" ON "agency_invitations" USING btree ("email","status");--> statement-breakpoint
CREATE INDEX "agency_invitations_agency_status_idx" ON "agency_invitations" USING btree ("agency_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_milestones_contract_position_unique" ON "contract_milestones" USING btree ("contract_id","position");--> statement-breakpoint
CREATE INDEX "contract_milestones_contract_status_idx" ON "contract_milestones" USING btree ("contract_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_proposal_id_unique" ON "contracts" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "contracts_client_status_idx" ON "contracts" USING btree ("client_id","status");--> statement-breakpoint
CREATE INDEX "contracts_freelancer_status_idx" ON "contracts" USING btree ("freelancer_id","status");--> statement-breakpoint
CREATE INDEX "earning_history_freelancer_created_idx" ON "earning_history" USING btree ("freelancer_id","created_at");--> statement-breakpoint
CREATE INDEX "earning_history_agency_created_idx" ON "earning_history" USING btree ("agency_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "meetings_provider_room_name_unique" ON "meetings" USING btree ("provider_room_name");--> statement-breakpoint
CREATE INDEX "meetings_conversation_status_idx" ON "meetings" USING btree ("conversation_id","status");--> statement-breakpoint
CREATE INDEX "payout_history_freelancer_created_idx" ON "payout_history" USING btree ("freelancer_id","created_at");--> statement-breakpoint
CREATE INDEX "payout_history_agency_created_idx" ON "payout_history" USING btree ("agency_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_contract_reviewer_unique" ON "reviews" USING btree ("contract_id","reviewer_id");--> statement-breakpoint
CREATE INDEX "reviews_reviewee_created_idx" ON "reviews" USING btree ("reviewee_id","created_at");--> statement-breakpoint
CREATE INDEX "reviews_agency_created_idx" ON "reviews" USING btree ("agency_id","created_at");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_agency_id_agency_metadata_id_fk" FOREIGN KEY ("agency_id") REFERENCES "public"."agency_metadata"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_stripe_customer_id_unique" UNIQUE("stripe_customer_id");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_stripe_connect_account_id_unique" UNIQUE("stripe_connect_account_id");--> statement-breakpoint
ALTER TABLE "client_metadata" ADD CONSTRAINT "client_metadata_auth_id_unique" UNIQUE("auth_id");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_target_check" CHECK (("notifications"."recipient_id" IS NOT NULL) <> ("notifications"."agency_id" IS NOT NULL));
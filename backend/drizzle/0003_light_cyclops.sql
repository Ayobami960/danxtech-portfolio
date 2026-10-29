ALTER TABLE "projects" ADD COLUMN "document_url" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "document_file_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "document_storage_key" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "document_name" varchar(255);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "document_size_bytes" integer;
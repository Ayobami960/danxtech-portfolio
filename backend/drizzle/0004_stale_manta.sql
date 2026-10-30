ALTER TABLE "resumes" ALTER COLUMN "size_bytes" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "resumes" ALTER COLUMN "sha256" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "url" text;--> statement-breakpoint
ALTER TABLE "resumes" ADD COLUMN "public_id" text;
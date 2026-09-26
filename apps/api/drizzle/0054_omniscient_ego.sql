ALTER TABLE "task" ADD COLUMN "constraint_type" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "constraint_date" timestamp;
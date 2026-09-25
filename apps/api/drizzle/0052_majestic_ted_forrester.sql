ALTER TABLE "task_relation" ADD COLUMN "dependency_type" text DEFAULT 'fs' NOT NULL;--> statement-breakpoint
ALTER TABLE "task_relation" ADD COLUMN "lag_days" integer DEFAULT 0 NOT NULL;
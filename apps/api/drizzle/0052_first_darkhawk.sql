ALTER TABLE "task" ADD COLUMN "progress" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "is_milestone" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "baseline_start_date" timestamp;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "baseline_due_date" timestamp;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_progress_range" CHECK ("task"."progress" >= 0 AND "task"."progress" <= 100);
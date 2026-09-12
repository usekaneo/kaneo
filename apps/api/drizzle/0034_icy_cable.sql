ALTER TABLE "project" ADD COLUMN "last_task_number" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "project" SET "last_task_number" = COALESCE((SELECT MAX("number") FROM "task" WHERE "task"."project_id" = "project"."id"), 0);

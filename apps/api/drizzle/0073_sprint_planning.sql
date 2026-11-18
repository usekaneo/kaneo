CREATE TABLE IF NOT EXISTS "sprint" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"goal" text,
	"status" text DEFAULT 'future' NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "sprint_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE cascade
);--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "sprint_id" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "type" text;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "default_sprint_length_days" integer DEFAULT 14 NOT NULL;--> statement-breakpoint
DO $add_task_sprint_fk$
BEGIN
	ALTER TABLE "task" ADD CONSTRAINT "task_sprint_id_sprint_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprint"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$add_task_sprint_fk$;--> statement-breakpoint
DO $add_sprint_project_name_unique$
BEGIN
	ALTER TABLE "sprint" ADD CONSTRAINT "sprint_project_name_unique" UNIQUE("project_id","name");
EXCEPTION
	WHEN duplicate_object THEN NULL;
END
$add_sprint_project_name_unique$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sprint_projectId_idx" ON "sprint" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sprint_projectId_position_idx" ON "sprint" USING btree ("project_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sprint_project_active_unique" ON "sprint" USING btree ("project_id") WHERE "sprint"."status" = 'active';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_sprintId_idx" ON "task" USING btree ("sprint_id");

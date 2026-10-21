CREATE TABLE "task_co_assignee" (
	"task_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "task_co_assignee_pair_unique" UNIQUE("task_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "task_co_assignee" ADD CONSTRAINT "task_co_assignee_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_co_assignee" ADD CONSTRAINT "task_co_assignee_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_co_assignee_user_idx" ON "task_co_assignee" USING btree ("user_id","task_id");
--> statement-breakpoint
UPDATE "task_reminder_sent" AS reminder
SET "reminder_type" = reminder."reminder_type" || ':' || task."assignee_id"
FROM "task" AS task
WHERE reminder."task_id" = task."id"
  AND task."assignee_id" IS NOT NULL
  AND reminder."reminder_type" IN ('configured_before', 'overdue');

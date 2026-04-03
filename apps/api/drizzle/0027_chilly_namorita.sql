CREATE TABLE "task_reminder_sent" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"reminder_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_reminder_sent_task_type_unique" UNIQUE("task_id","reminder_type")
);
--> statement-breakpoint
ALTER TABLE "task_reminder_sent" ADD CONSTRAINT "task_reminder_sent_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_reminder_sent_taskId_idx" ON "task_reminder_sent" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_dueDate_idx" ON "task" USING btree ("due_date");
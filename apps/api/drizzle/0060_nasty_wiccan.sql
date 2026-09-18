CREATE TABLE "task_attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"kind" text NOT NULL,
	"file_id" text,
	"url" text,
	"title" text NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_attachment" ADD CONSTRAINT "task_attachment_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_attachment" ADD CONSTRAINT "task_attachment_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_attachment" ADD CONSTRAINT "task_attachment_file_id_stored_file_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."stored_file"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_attachment" ADD CONSTRAINT "task_attachment_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_attachment_taskId_idx" ON "task_attachment" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_attachment_fileId_idx" ON "task_attachment" USING btree ("file_id");
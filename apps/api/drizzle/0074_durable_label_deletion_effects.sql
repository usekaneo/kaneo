CREATE TABLE "label_deletion" (
	"id" text PRIMARY KEY NOT NULL,
	"deletion_id" text NOT NULL,
	"user_id" text NOT NULL,
	"pending_effects" text[] DEFAULT ARRAY['github', 'gitea', 'gitlab', 'event']::text[] NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"deletion_started_at" timestamp,
	"task_id" text,
	"workspace_id" text
);
--> statement-breakpoint
ALTER TABLE "label_deletion" ADD CONSTRAINT "label_deletion_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "label_deletion" ADD CONSTRAINT "label_deletion_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "label_deletion_deletion_id_idx" ON "label_deletion" USING btree ("deletion_id");--> statement-breakpoint
CREATE INDEX "label_deletion_task_id_idx" ON "label_deletion" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "label_deletion_workspace_id_idx" ON "label_deletion" USING btree ("workspace_id");
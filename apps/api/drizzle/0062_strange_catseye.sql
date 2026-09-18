CREATE TABLE "task_checklist" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"title" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_relation" ADD COLUMN "checklist_id" text;--> statement-breakpoint
ALTER TABLE "task_relation" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "task_checklist" ADD CONSTRAINT "task_checklist_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_checklist_task_idx" ON "task_checklist" USING btree ("task_id");--> statement-breakpoint
ALTER TABLE "task_relation" ADD CONSTRAINT "task_relation_checklist_id_task_checklist_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."task_checklist"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_relation_checklist_idx" ON "task_relation" USING btree ("checklist_id");
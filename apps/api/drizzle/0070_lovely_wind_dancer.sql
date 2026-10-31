CREATE TABLE "contact" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"type" text DEFAULT 'other' NOT NULL,
	"region" text DEFAULT 'other' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "contact_id" text;--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "contact_workspace_name_idx" ON "contact" USING btree ("workspace_id","name");--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_contactId_idx" ON "task" USING btree ("contact_id");
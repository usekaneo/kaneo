CREATE TABLE "billing_reminder_sent" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"reminder_type" text NOT NULL,
	"trial_ends_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_reminder_sent_workspace_type_unique" UNIQUE("workspace_id","reminder_type")
);
--> statement-breakpoint
ALTER TABLE "billing_reminder_sent" ADD CONSTRAINT "billing_reminder_sent_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "billing_reminder_sent_workspaceId_idx" ON "billing_reminder_sent" USING btree ("workspace_id");
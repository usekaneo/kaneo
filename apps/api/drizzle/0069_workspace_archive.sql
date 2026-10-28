ALTER TABLE "workspace" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "archived_by" text;--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_archived_by_user_id_fk" FOREIGN KEY ("archived_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
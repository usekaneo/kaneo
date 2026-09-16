ALTER TABLE "billing_reminder_sent" DROP CONSTRAINT "billing_reminder_sent_workspace_type_unique";--> statement-breakpoint
ALTER TABLE "billing_reminder_sent" ADD COLUMN "user_id" text;--> statement-breakpoint
UPDATE "billing_reminder_sent" r SET "user_id" = m."user_id" FROM "workspace_member" m WHERE m."workspace_id" = r."workspace_id" AND m."role" = 'owner';--> statement-breakpoint
DELETE FROM "billing_reminder_sent" WHERE "user_id" IS NULL;--> statement-breakpoint
DELETE FROM "billing_reminder_sent" a USING "billing_reminder_sent" b WHERE a."user_id" = b."user_id" AND a."reminder_type" = b."reminder_type" AND (a."created_at" > b."created_at" OR (a."created_at" = b."created_at" AND a."ctid" > b."ctid"));--> statement-breakpoint
ALTER TABLE "billing_reminder_sent" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_reminder_sent" ADD CONSTRAINT "billing_reminder_sent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "billing_reminder_sent_userId_idx" ON "billing_reminder_sent" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "billing_reminder_sent" ADD CONSTRAINT "billing_reminder_sent_user_type_unique" UNIQUE("user_id","reminder_type");

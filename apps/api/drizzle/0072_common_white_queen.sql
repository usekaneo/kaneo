CREATE TABLE "contact_option" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact" ALTER COLUMN "type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "contact" ALTER COLUMN "type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "contact" ALTER COLUMN "region" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "contact" ALTER COLUMN "region" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_option" ADD CONSTRAINT "contact_option_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "contact_option_workspace_kind_key_idx" ON "contact_option" USING btree ("workspace_id","kind","key");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_option_workspace_kind_label_idx" ON "contact_option" USING btree ("workspace_id","kind",lower("label"));
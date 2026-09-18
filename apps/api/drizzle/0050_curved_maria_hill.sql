CREATE TABLE "workspace_storage" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"endpoint" text NOT NULL,
	"bucket" text NOT NULL,
	"region" text DEFAULT 'auto' NOT NULL,
	"access_key_id" text NOT NULL,
	"secret_access_key" text NOT NULL,
	"key_prefix" text DEFAULT '' NOT NULL,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stored_file" ADD COLUMN "kind" text DEFAULT 'receipt' NOT NULL;--> statement-breakpoint
ALTER TABLE "stored_file" ADD COLUMN "folder" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "stored_file" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "workspace_storage" ADD CONSTRAINT "workspace_storage_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "workspace_storage" ADD CONSTRAINT "workspace_storage_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "stored_file_workspace_kind_folder_idx" ON "stored_file" USING btree ("workspace_id","kind","folder");--> statement-breakpoint
ALTER TABLE "stored_file" ADD CONSTRAINT "stored_file_share_token_unique" UNIQUE("share_token");
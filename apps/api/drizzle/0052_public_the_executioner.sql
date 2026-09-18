CREATE TABLE "file_folder" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"path" text NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "file_folder" ADD CONSTRAINT "file_folder_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "file_folder" ADD CONSTRAINT "file_folder_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "file_folder_workspace_path_idx" ON "file_folder" USING btree ("workspace_id","path");
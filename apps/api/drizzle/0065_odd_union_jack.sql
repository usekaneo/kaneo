CREATE TABLE "personal_project_view" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"config" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "personal_project_view" ADD CONSTRAINT "personal_project_view_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_project_view" ADD CONSTRAINT "personal_project_view_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "personal_project_view_owner_project_idx" ON "personal_project_view" USING btree ("user_id","project_id");
CREATE TABLE "external_links" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"external_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
ALTER TABLE "external_links" ADD CONSTRAINT "external_links_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "external_links" ADD CONSTRAINT "external_links_created_by_user_email_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("email") ON DELETE set null ON UPDATE cascade;
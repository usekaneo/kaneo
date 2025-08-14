CREATE TYPE "public"."task_link_type" AS ENUM('blocks', 'blocked_by', 'relates_to', 'duplicates', 'parent', 'child');--> statement-breakpoint
CREATE TABLE "task_link" (
	"id" text PRIMARY KEY NOT NULL,
	"from_task_id" text NOT NULL,
	"to_task_id" text NOT NULL,
	"type" "task_link_type" NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_link" ADD CONSTRAINT "task_link_from_task_id_task_id_fk" FOREIGN KEY ("from_task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_link" ADD CONSTRAINT "task_link_to_task_id_task_id_fk" FOREIGN KEY ("to_task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_link" ADD CONSTRAINT "task_link_created_by_user_email_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("email") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "task_link_unique" ON "task_link" USING btree ("from_task_id","to_task_id","type");
CREATE TABLE "task_share" (
	"task_id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "task_share_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "task_share" ADD CONSTRAINT "task_share_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;

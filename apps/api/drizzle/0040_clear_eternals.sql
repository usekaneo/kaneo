CREATE TABLE "user_avatar" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_avatar_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "activity" DROP CONSTRAINT IF EXISTS "activity_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "task" DROP CONSTRAINT IF EXISTS "task_assignee_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "time_entry" DROP CONSTRAINT IF EXISTS "time_entry_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "user_avatar" ADD CONSTRAINT "user_avatar_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "user_avatar_userId_idx" ON "user_avatar" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "time_entry" ADD CONSTRAINT "time_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;
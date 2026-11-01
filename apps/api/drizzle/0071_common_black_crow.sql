CREATE TABLE "task_assignee" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "task_assignee_task_user_unique" UNIQUE("task_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "task_assignee" ADD CONSTRAINT "task_assignee_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task_assignee" ADD CONSTRAINT "task_assignee_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_assignee_userId_idx" ON "task_assignee" USING btree ("user_id");--> statement-breakpoint
INSERT INTO "task_assignee" ("id", "task_id", "user_id")
SELECT gen_random_uuid()::text, "id", "assignee_id" FROM "task" WHERE "assignee_id" IS NOT NULL
ON CONFLICT ("task_id", "user_id") DO NOTHING;--> statement-breakpoint
-- Deleting a user nulls task.assignee_id (foreign key) but cascades only that
-- user's task_assignee rows, which would leave co-assignees without a primary.
-- Hand the primary role to the next assignee in the same transaction as the delete.
CREATE FUNCTION "task_assignee_hand_over_primary"() RETURNS trigger AS $$
BEGIN
  UPDATE "task"
  SET "assignee_id" = (
    SELECT "ta"."user_id" FROM "task_assignee" AS "ta"
    WHERE "ta"."task_id" = "task"."id" AND "ta"."user_id" <> OLD."id"
    ORDER BY "ta"."created_at", "ta"."id"
    LIMIT 1
  )
  WHERE "task"."assignee_id" = OLD."id";
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "task_assignee_hand_over_primary" BEFORE DELETE ON "user" FOR EACH ROW EXECUTE FUNCTION "task_assignee_hand_over_primary"();

ALTER TABLE "time_entry" ADD COLUMN "billable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- One-time repair for upgraded installs: previously nothing prevented a user
-- from holding several open entries (end_time IS NULL), which would make the
-- partial unique index below fail to create. Keep only the newest open entry
-- per user and auto-stop the rest with the migration timestamp, so the
-- one-running-timer-per-user invariant holds before the index is created.
-- Fresh installs have no rows and skip this harmlessly.
UPDATE "time_entry" AS "older_time_entry"
SET
  "end_time" = NOW(),
  "duration" = LEAST(
    2147483647,
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (NOW() - "older_time_entry"."start_time"))))
  )::integer
WHERE "older_time_entry"."end_time" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "time_entry" AS "newer_time_entry"
    WHERE "newer_time_entry"."user_id" IS NOT DISTINCT FROM "older_time_entry"."user_id"
      AND "newer_time_entry"."end_time" IS NULL
      AND ("newer_time_entry"."start_time", "newer_time_entry"."id") > ("older_time_entry"."start_time", "older_time_entry"."id")
  );--> statement-breakpoint
CREATE UNIQUE INDEX "time_entry_running_user_unique" ON "time_entry" USING btree ("user_id") WHERE "time_entry"."end_time" IS NULL;
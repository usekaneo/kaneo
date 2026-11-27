-- Migration 0003 populated legacy credential rows with user.email as account_id
-- instead of user.id. Better Auth 1.7+ requires account_id = user_id for
-- credential sign-in and password validation.
DELETE FROM "account" AS stale
WHERE stale."provider_id" = 'credential'
  AND stale."account_id" <> stale."user_id"
  AND (
    EXISTS (
      SELECT 1
      FROM "account" AS canonical
      WHERE canonical."user_id" = stale."user_id"
        AND canonical."provider_id" = 'credential'
        AND canonical."account_id" = canonical."user_id"
    )
    OR EXISTS (
      SELECT 1
      FROM "account" AS newer
      WHERE newer."user_id" = stale."user_id"
        AND newer."provider_id" = 'credential'
        AND newer."account_id" <> newer."user_id"
        AND (
          (newer."updated_at", newer."created_at", newer."id")
          > (stale."updated_at", stale."created_at", stale."id")
        )
    )
  );
--> statement-breakpoint
UPDATE "account"
SET "account_id" = "user_id"
WHERE "provider_id" = 'credential'
  AND "account_id" <> "user_id";
--> statement-breakpoint
-- Better Auth 1.7+ lowercases email addresses during credential sign-in.
-- Normalize legacy mixed-case user emails when doing so does not collide with
-- an existing account.
UPDATE "user" AS u
SET "email" = lower(u."email")
WHERE u."email" <> lower(u."email")
  AND NOT EXISTS (
    SELECT 1
    FROM "user" AS existing
    WHERE lower(existing."email") = lower(u."email")
      AND existing."id" <> u."id"
  );

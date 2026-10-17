-- Signup hooks never ran for users created before instance roles existed.
-- Repair those installations once, without re-promoting users on every restart.
UPDATE "user"
SET "role" = 'admin'
WHERE "id" = (
  SELECT "id" FROM "user"
  WHERE "is_anonymous" IS NOT TRUE
  ORDER BY "created_at", "id"
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM "user"
  WHERE "is_anonymous" IS NOT TRUE
    AND 'admin' = ANY(string_to_array("role", ','))
);
--> statement-breakpoint
UPDATE "user" SET "role" = 'user' WHERE "role" IS NULL;

-- An older journal used the same timestamp for a comment-only migration.
-- A new migration must repair those upgrades; changing migration 0015 cannot.
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "archived_at" timestamp;
--> statement-breakpoint
-- Backfill only keys without a reference from an existing legacy owner. Never
-- reinterpret a non-null reference as a different owner's credential.
UPDATE "apikey" AS k
SET "reference_id" = k."user_id"
FROM "user" AS u
WHERE k."reference_id" IS NULL AND k."user_id" = u."id";
--> statement-breakpoint
-- Ownerless/orphaned credentials cannot meet the ownership invariant and must
-- not remain authenticatable. Valid credentials and their hashes stay intact.
DELETE FROM "apikey" AS k
WHERE k."reference_id" IS NULL
   OR NOT EXISTS (SELECT 1 FROM "user" AS u WHERE u."id" = k."reference_id");
--> statement-breakpoint
ALTER TABLE "apikey" ALTER COLUMN "reference_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "apikey" DROP CONSTRAINT IF EXISTS "apikey_reference_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "apikey" ADD CONSTRAINT "apikey_reference_id_user_id_fk"
  FOREIGN KEY ("reference_id") REFERENCES "public"."user"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;

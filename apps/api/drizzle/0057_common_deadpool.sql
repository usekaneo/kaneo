CREATE TABLE "storage_cleanup" (
	"object_key" text PRIMARY KEY NOT NULL,
	"last_attempt_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "project_background_object_key_idx" ON "project" USING btree ("background_object_key") WHERE "project"."background_object_key" is not null;
--> statement-breakpoint
-- Capture keys for every cascade, including workspace deletion. The outbox has
-- no owner FK, so its records survive the deletion transaction.
CREATE FUNCTION queue_deleted_storage_object() RETURNS trigger AS $$
DECLARE cleanup_key text;
BEGIN
  IF TG_TABLE_NAME = 'asset' THEN
    cleanup_key := OLD.object_key;
  ELSE
    cleanup_key := OLD.background_object_key;
  END IF;
  IF cleanup_key IS NOT NULL THEN
    INSERT INTO storage_cleanup (object_key) VALUES (cleanup_key)
      ON CONFLICT (object_key) DO NOTHING;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER asset_storage_cleanup BEFORE DELETE ON asset
  FOR EACH ROW EXECUTE FUNCTION queue_deleted_storage_object();
--> statement-breakpoint
CREATE TRIGGER project_storage_cleanup BEFORE DELETE ON project
  FOR EACH ROW EXECUTE FUNCTION queue_deleted_storage_object();

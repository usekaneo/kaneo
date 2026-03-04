ALTER TABLE "apikey" ADD COLUMN IF NOT EXISTS "config_id" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "apikey" ADD COLUMN IF NOT EXISTS "reference_id" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "apikey_configId_idx" ON "apikey" USING btree ("config_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "apikey_referenceId_idx" ON "apikey" USING btree ("reference_id");

ALTER TABLE "time_entry"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();--> statement-breakpoint
UPDATE "time_entry"
  SET "updated_at" = "created_at"
  WHERE "updated_at" IS NULL;--> statement-breakpoint
ALTER TABLE "time_entry"
  ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "time_entry"
  ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notification"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
UPDATE "notification"
  SET "updated_at" = "created_at"
  WHERE "updated_at" IS NULL;--> statement-breakpoint
ALTER TABLE "notification"
  ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "notification"
  ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint

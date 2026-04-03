ALTER TABLE "device_code" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "device_code" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;

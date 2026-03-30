ALTER TABLE "notification" ALTER COLUMN "title" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "event_data" jsonb;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "event_data" jsonb;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "locale" text;
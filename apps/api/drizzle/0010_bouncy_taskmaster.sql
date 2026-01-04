ALTER TABLE "activity" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "external_user_name" text;--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "external_user_avatar" text;--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "external_source" text;
ALTER TABLE "user_notification_preference" ADD COLUMN "gotify_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD COLUMN "gotify_server_url" text;--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD COLUMN "gotify_token" text;--> statement-breakpoint
ALTER TABLE "user_notification_workspace_rule" ADD COLUMN "gotify_enabled" boolean DEFAULT false NOT NULL;
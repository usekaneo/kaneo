ALTER TABLE "user_notification_preference" ADD COLUMN "task_assignment_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD COLUMN "task_comment_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD COLUMN "task_status_change_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD COLUMN "due_date_reminder_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD COLUMN "due_date_reminder_lead_time_minutes" integer DEFAULT 1440 NOT NULL;

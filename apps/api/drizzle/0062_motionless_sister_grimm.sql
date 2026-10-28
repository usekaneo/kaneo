ALTER TABLE IF EXISTS "account" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "activity" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "activity" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "asset" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "billing_event" ALTER COLUMN "processed_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "billing_reminder_sent" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "billing_reminder_sent" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "calendar_feed" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "column" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "column" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "comment" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "comment" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "custom_field_definition" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "custom_field_definition" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "custom_field_value" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "custom_field_value" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "data_migration" ALTER COLUMN "completed_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "device_code" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "device_code" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "external_link" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "external_link" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "github_import" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "integration" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "integration" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "invitation" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "label" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "label" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "mcp_oauth_state" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "mcp_oauth_state" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "workspace_role" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "workspace_role" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "project" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "session" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "storage_cleanup" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "task_relation" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "task_reminder_sent" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "task_reminder_sent" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "task" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "task" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "time_entry" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "time_entry" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "trial_grant" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "user" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "user" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "user_avatar" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "user_avatar" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
-- Drifted installs can lack these timestamp columns until the startup repair
-- adds them, which runs after migrations. Only change columns that exist; the
-- repair creates missing ones with this default.
DO $$
DECLARE
	target record;
BEGIN
	FOR target IN
		SELECT table_name, column_name
		FROM information_schema.columns
		WHERE table_schema = current_schema()
			AND table_name IN ('user_notification_preference', 'user_notification_workspace_project', 'user_notification_workspace_rule')
			AND column_name IN ('created_at', 'updated_at')
	LOOP
		EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET DEFAULT (now() AT TIME ZONE ''utc'')', target.table_name, target.column_name);
	END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE IF EXISTS "verification" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "verification" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "workflow_rule" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "workflow_rule" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "workspace_billing" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "workspace_billing" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "workspace_member_access" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "workspace_member_access" ALTER COLUMN "updated_at" SET DEFAULT (now() AT TIME ZONE 'utc');--> statement-breakpoint
ALTER TABLE IF EXISTS "workspace_member_project" ALTER COLUMN "created_at" SET DEFAULT (now() AT TIME ZONE 'utc');
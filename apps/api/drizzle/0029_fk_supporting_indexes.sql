ALTER TABLE "time_entry"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();--> statement-breakpoint
UPDATE "time_entry"
  SET "updated_at" = "created_at"
  WHERE "updated_at" IS NULL;--> statement-breakpoint
ALTER TABLE "time_entry"
  ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "time_entry"
  ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_notification_workspace_project_workspaceId_projectId_idx"
  ON "user_notification_workspace_project" USING btree ("workspace_id", "project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_notification_workspace_project_workspaceId_workspaceRuleId_idx"
  ON "user_notification_workspace_project" USING btree ("workspace_id", "workspace_rule_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_rule_columnId_idx"
  ON "workflow_rule" USING btree ("column_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_userId_idx"
  ON "activity" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_createdBy_idx"
  ON "asset" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitation_inviterId_idx"
  ON "invitation" USING btree ("inviter_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_userId_idx"
  ON "notification" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_assigneeId_idx"
  ON "task" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_columnId_idx"
  ON "task" USING btree ("column_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "time_entry_taskId_idx"
  ON "time_entry" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "time_entry_userId_idx"
  ON "time_entry" USING btree ("user_id");--> statement-breakpoint

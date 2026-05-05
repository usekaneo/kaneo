import { pool } from "../database";

export const FK_SUPPORTING_INDEX_STATEMENTS = [
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS "user_notification_workspace_project_workspaceId_projectId_idx" ON "user_notification_workspace_project" USING btree ("workspace_id", "project_id")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS "user_notification_workspace_project_workspaceId_workspaceRuleId_idx" ON "user_notification_workspace_project" USING btree ("workspace_id", "workspace_rule_id")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS "workflow_rule_columnId_idx" ON "workflow_rule" USING btree ("column_id")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS "activity_userId_idx" ON "activity" USING btree ("user_id")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS "asset_createdBy_idx" ON "asset" USING btree ("created_by")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS "invitation_inviterId_idx" ON "invitation" USING btree ("inviter_id")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS "notification_userId_idx" ON "notification" USING btree ("user_id")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS "task_assigneeId_idx" ON "task" USING btree ("assignee_id")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS "task_columnId_idx" ON "task" USING btree ("column_id")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS "time_entry_taskId_idx" ON "time_entry" USING btree ("task_id")',
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS "time_entry_userId_idx" ON "time_entry" USING btree ("user_id")',
] as const;

export async function createFkSupportingIndexes() {
  console.log("🔄 Creating FK-supporting indexes...");

  for (const statement of FK_SUPPORTING_INDEX_STATEMENTS) {
    await pool.query(statement);
  }

  console.log("✅ FK-supporting indexes ready!");
}

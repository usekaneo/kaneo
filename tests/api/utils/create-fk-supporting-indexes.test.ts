import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "drizzle/0029_fk_supporting_indexes.sql",
);
const migrationSql = readFileSync(migrationPath, "utf8");

describe("0029_fk_supporting_indexes migration", () => {
  it("uses direct NOT NULL column adds instead of split backfill steps", () => {
    expect(migrationSql).toContain(
      'ALTER TABLE "notification" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;',
    );
    expect(migrationSql).toContain(
      'ALTER TABLE "time_entry" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;',
    );
    expect(migrationSql).not.toContain('UPDATE "notification"');
    expect(migrationSql).not.toContain('UPDATE "time_entry"');
    expect(migrationSql).not.toContain('ALTER COLUMN "updated_at"');
  });

  it("creates expected FK-supporting indexes in migration", () => {
    const indexNames = [
      "activity_userId_idx",
      "asset_createdBy_idx",
      "invitation_inviterId_idx",
      "notification_userId_idx",
      "task_assigneeId_idx",
      "task_columnId_idx",
      "time_entry_taskId_idx",
      "time_entry_userId_idx",
      "user_notification_workspace_project_workspaceId_projectId_idx",
      "unwp_workspaceId_workspaceRuleId_idx",
      "workflow_rule_columnId_idx",
    ];

    for (const indexName of indexNames) {
      expect(migrationSql).toContain(`CREATE INDEX "${indexName}"`);
    }

    expect(migrationSql.match(/CREATE INDEX /g)).toHaveLength(
      indexNames.length,
    );
    expect(migrationSql).not.toContain("CONCURRENTLY");
  });
});

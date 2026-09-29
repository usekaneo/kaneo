import { eq } from "drizzle-orm";
import { beforeEach, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { migrateColumns } from "../../apps/api/src/migrations/column-migration";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);
it("does not recreate a migrated workflow rule after deletion and restart", async () => {
  const { workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  await db.insert(schema.integrationTable).values({
    projectId: project.id,
    type: "gitea",
    isActive: true,
    config: JSON.stringify({ statusTransitions: { onPROpen: "to-do" } }),
  });
  await migrateColumns();
  const rules = await db
    .select()
    .from(schema.workflowRuleTable)
    .where(eq(schema.workflowRuleTable.projectId, project.id));
  expect(rules).toHaveLength(1);
  await db
    .delete(schema.workflowRuleTable)
    .where(eq(schema.workflowRuleTable.id, rules[0].id));
  await migrateColumns();
  expect(
    await db
      .select()
      .from(schema.workflowRuleTable)
      .where(eq(schema.workflowRuleTable.projectId, project.id)),
  ).toHaveLength(0);
});

it("preserves missing user-managed default rules on an already migrated project", async () => {
  const { workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  await db.insert(schema.integrationTable).values({
    projectId: project.id,
    type: "gitea",
    isActive: true,
    config: "{}",
  });
  await migrateColumns();
  expect(await db.select().from(schema.workflowRuleTable)).toHaveLength(0);
});

it("skips malformed legacy configuration without blocking startup", async () => {
  const { workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  await db.insert(schema.integrationTable).values({
    projectId: project.id,
    type: "gitea",
    isActive: true,
    config: "{",
  });
  await expect(migrateColumns()).resolves.toBeUndefined();
  expect(await db.select().from(schema.dataMigrationTable)).toHaveLength(1);
});

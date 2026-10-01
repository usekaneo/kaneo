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
it("preserves a rule deleted before the completion marker existed", async () => {
  const { workspace } = await createWorkspaceMember();
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  await db.insert(schema.integrationTable).values({
    projectId: project.id,
    type: "gitea",
    isActive: true,
    config: JSON.stringify({ statusTransitions: { onPROpen: "to-do" } }),
  });
  await db.insert(schema.workflowRuleTable).values({
    projectId: project.id,
    integrationType: "gitea",
    eventType: "pr_opened",
    columnId: columns.todo.id,
  });
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
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({
      projectId: project.id,
      type: "gitea",
      isActive: true,
      config: "{",
    })
    .returning();
  await expect(migrateColumns()).resolves.toBeUndefined();
  expect(await db.select().from(schema.dataMigrationTable)).toEqual([
    expect.objectContaining({
      id: `column-workflow-pending:${integration.id}`,
    }),
  ]);
  await db
    .update(schema.integrationTable)
    .set({
      config: JSON.stringify({ statusTransitions: { onPROpen: "to-do" } }),
    })
    .where(eq(schema.integrationTable.id, integration.id));
  await migrateColumns();
  expect(await db.select().from(schema.workflowRuleTable)).toHaveLength(3);
  expect(await db.select().from(schema.dataMigrationTable)).toEqual([
    expect.objectContaining({ id: "column-workflow-v1" }),
  ]);
});

it("migrates disabled legacy integrations and does not restore later deletions", async () => {
  const { workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  await db
    .delete(schema.columnTable)
    .where(eq(schema.columnTable.projectId, project.id));
  await db.insert(schema.integrationTable).values({
    projectId: project.id,
    type: "gitea",
    isActive: false,
    config: JSON.stringify({ statusTransitions: { onPROpen: "to-do" } }),
  });
  await migrateColumns();
  const rules = await db.select().from(schema.workflowRuleTable);
  expect(rules).toHaveLength(3);
  await db
    .delete(schema.workflowRuleTable)
    .where(eq(schema.workflowRuleTable.id, rules[0].id));
  await migrateColumns();
  expect(await db.select().from(schema.workflowRuleTable)).toHaveLength(2);
});

it("resumes malformed legacy integrations after repair without remigrating completed projects", async () => {
  const { workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  await db
    .delete(schema.columnTable)
    .where(eq(schema.columnTable.projectId, project.id));
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({ projectId: project.id, type: "gitea", config: "{" })
    .returning();
  await migrateColumns();
  expect(await db.select().from(schema.columnTable)).toHaveLength(4);
  expect(await db.select().from(schema.workflowRuleTable)).toHaveLength(0);
  expect(await db.select().from(schema.dataMigrationTable)).toEqual([
    expect.objectContaining({
      id: `column-workflow-pending:${integration.id}`,
    }),
  ]);
  await db
    .update(schema.integrationTable)
    .set({
      config: JSON.stringify({ statusTransitions: { onPROpen: "to-do" } }),
    })
    .where(eq(schema.integrationTable.id, integration.id));
  await migrateColumns();
  expect(await db.select().from(schema.workflowRuleTable)).toHaveLength(3);
  expect(await db.select().from(schema.dataMigrationTable)).toEqual([
    expect.objectContaining({ id: "column-workflow-v1" }),
  ]);
});

it.each(["invalid", null, [], { onPROpen: 1 }])(
  "keeps malformed transitions %j pending until repaired",
  async (statusTransitions) => {
    const { workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const [integration] = await db
      .insert(schema.integrationTable)
      .values({
        projectId: project.id,
        type: "gitea",
        config: JSON.stringify({ statusTransitions }),
      })
      .returning();
    await migrateColumns();
    expect(await db.select().from(schema.workflowRuleTable)).toHaveLength(0);
    expect(await db.select().from(schema.dataMigrationTable)).toEqual([
      expect.objectContaining({
        id: `column-workflow-pending:${integration.id}`,
      }),
    ]);
    await db
      .update(schema.integrationTable)
      .set({
        config: JSON.stringify({ statusTransitions: { onPROpen: "to-do" } }),
      })
      .where(eq(schema.integrationTable.id, integration.id));
    await migrateColumns();
    expect(await db.select().from(schema.workflowRuleTable)).toHaveLength(3);
    expect(await db.select().from(schema.dataMigrationTable)).toEqual([
      expect.objectContaining({ id: "column-workflow-v1" }),
    ]);
  },
);

it("migrates recognized transitions while ignoring unrelated legacy flags", async () => {
  const { workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  await db
    .delete(schema.columnTable)
    .where(eq(schema.columnTable.projectId, project.id));
  await db.insert(schema.integrationTable).values({
    projectId: project.id,
    type: "gitea",
    config: JSON.stringify({
      statusTransitions: { onPROpen: "in-review", legacyFlag: false },
    }),
  });
  await migrateColumns();
  expect(await db.select().from(schema.workflowRuleTable)).toHaveLength(3);
  expect(await db.select().from(schema.dataMigrationTable)).toEqual([
    expect.objectContaining({ id: "column-workflow-v1" }),
  ]);
});

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import * as events from "../../apps/api/src/events";
import { initializeEventSubscriptions } from "../../apps/api/src/plugins/registry";
import * as reconciliation from "../../apps/api/src/plugins/sync/reconcile";
import { canSyncTask } from "../../apps/api/src/plugins/sync/eligibility";
import moveProject from "../../apps/api/src/project/controllers/move-project";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeAll(() => {
  initializeEventSubscriptions();
});
beforeEach(async () => {
  await resetTestDatabase();
});

it.each(
  (["github", "gitea", "gitlab"] as const).flatMap((provider) =>
    [true, false].map((restricted) => ({ provider, restricted })),
  ),
)(
  "$provider reconciles a project move (restricted=$restricted)",
  async ({ provider, restricted }) => {
    const source = await createWorkspaceMember();
    const target = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: target.workspace.id,
      userId: source.user.id,
      role: "owner",
      joinedAt: new Date(),
    });
    const { project, columns } = await createProjectFixture({
      workspaceId: source.workspace.id,
    });
    const [label] = await db
      .insert(schema.labelTable)
      .values({
        workspaceId: source.workspace.id,
        name: "export",
        color: "red",
      })
      .returning();
    await db.insert(schema.labelTable).values({
      workspaceId: target.workspace.id,
      name: "export",
      color: "red",
    });
    const [integration] = await db
      .insert(schema.integrationTable)
      .values({
        projectId: project.id,
        type: provider,
        isActive: true,
        config: JSON.stringify({
          syncRules: {
            outgoing: restricted
              ? { mode: "labels", match: "any", labels: [label.id] }
              : { mode: "all" },
            incoming: { mode: "all" },
          },
        }),
      })
      .returning();
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Moved task",
        number: 1,
        status: "to-do",
        columnId: columns.todo.id,
      })
      .returning();
    await db.insert(schema.labelTable).values({
      taskId: task.id,
      workspaceId: source.workspace.id,
      name: "export",
      color: "red",
    });
    const [link] = await db
      .insert(schema.externalLinkTable)
      .values({
        taskId: task.id,
        integrationId: integration.id,
        resourceType: "issue",
        externalId: "9",
        url: "https://git.example/team/repo/issues/9",
        metadata: JSON.stringify({ retained: "keep" }),
      })
      .returning();
    let complete!: () => void;
    const completed = new Promise<void>((resolve) => {
      complete = resolve;
    });
    const reconcile = reconciliation.reconcileProjectSync;
    const handler = vi
      .spyOn(reconciliation, "reconcileProjectSync")
      .mockImplementationOnce(async (...args) => {
        try {
          await reconcile(...args);
        } finally {
          complete();
        }
      });
    const publish = vi.spyOn(events, "publishEvent");

    await moveProject(
      project.id,
      source.workspace.id,
      target.workspace.id,
      source.user.id,
    );
    await completed;

    expect(handler).toHaveBeenCalledWith(project.id, undefined);
    expect(publish).toHaveBeenCalledWith("project.updated", {
      projectId: project.id,
    });
    const stored = await db.query.externalLinkTable.findFirst({
      where: eq(schema.externalLinkTable.id, link.id),
    });
    expect(JSON.parse(stored!.metadata!)).toEqual(
      restricted
        ? { retained: "keep", syncFilterPaused: true }
        : { retained: "keep" },
    );
    expect(stored).toMatchObject({
      taskId: task.id,
      integrationId: integration.id,
      externalId: "9",
    });
    expect(await canSyncTask(task.id, integration.id)).toBe(!restricted);
    expect(
      await db.query.labelTable.findFirst({
        where: eq(schema.labelTable.id, label.id),
      }),
    ).toMatchObject({ workspaceId: source.workspace.id });
  },
);

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const m = vi.hoisted(() => ({ publish: vi.fn(async () => undefined) }));
vi.mock("../../apps/api/src/events", async (original) => ({
  ...(await original<object>()),
  publishEvent: m.publish,
}));
beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
});

async function setup(role = "member") {
  const member = await createWorkspaceMember({ role });
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [parent] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Parent",
      status: "to-do",
      number: 1,
    })
    .returning();
  await db
    .update(schema.projectTable)
    .set({ lastTaskNumber: 1 })
    .where(eq(schema.projectTable.id, project.id));
  mockAuthenticatedSession(member.user);
  return { ...member, project, parent };
}

function create(projectId: string, parentTaskId?: string) {
  return createApp().app.request(`/api/task/${projectId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "New subtask",
      description: "",
      status: "to-do",
      priority: "no-priority",
      parentTaskId,
    }),
  });
}

describe("atomic subtask creation", () => {
  it("creates the task and parent link together and publishes both events", async () => {
    const ctx = await setup();
    const response = await create(ctx.project.id, ctx.parent.id);
    expect(response.status).toBe(200);
    const child = await response.json();
    expect(child.subtaskParents).toEqual([
      {
        id: ctx.parent.id,
        title: ctx.parent.title,
        projectId: ctx.parent.projectId,
      },
    ]);
    expect(await db.query.taskRelationTable.findMany()).toMatchObject([
      {
        sourceTaskId: ctx.parent.id,
        targetTaskId: child.id,
        relationType: "subtask",
      },
    ]);
    expect(m.publish).toHaveBeenCalledWith(
      "task.created",
      expect.objectContaining({ taskId: child.id }),
    );
    expect(m.publish).toHaveBeenCalledWith(
      "task-relation.created",
      expect.objectContaining({
        sourceTaskId: ctx.parent.id,
        targetTaskId: child.id,
      }),
    );
  });

  it("does not leave an orphan task or consume a number when the parent is missing or in another project", async () => {
    const ctx = await setup();
    const other = await createProjectFixture({ workspaceId: ctx.workspace.id });
    const [foreign] = await db
      .insert(schema.taskTable)
      .values({ projectId: other.project.id, title: "Foreign parent" })
      .returning();
    const before = await db.query.projectTable.findFirst({
      where: eq(schema.projectTable.id, ctx.project.id),
    });
    for (const parent of ["missing", foreign.id]) {
      expect((await create(ctx.project.id, parent)).status).toBe(400);
    }
    const after = await db.query.projectTable.findFirst({
      where: eq(schema.projectTable.id, ctx.project.id),
    });
    expect(after).toEqual(before);
    expect(await db.query.taskTable.findMany()).toHaveLength(2);
    expect(await db.query.taskRelationTable.findMany()).toHaveLength(0);
    expect(m.publish).not.toHaveBeenCalled();
  });

  it("requires update permission for the link but still allows ordinary task creation", async () => {
    const ctx = await setup("creator");
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: ctx.workspace.id,
      role: "creator",
      permission: JSON.stringify({ task: ["create", "read"] }),
    });
    expect((await create(ctx.project.id, ctx.parent.id)).status).toBe(403);
    expect(await db.query.taskTable.findMany()).toHaveLength(1);
    expect(await db.query.taskRelationTable.findMany()).toHaveLength(0);
    expect((await create(ctx.project.id)).status).toBe(200);
  });
});

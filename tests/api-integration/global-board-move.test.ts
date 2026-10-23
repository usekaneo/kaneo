import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

type Project = Awaited<ReturnType<typeof createProjectFixture>>;
type User = Awaited<ReturnType<typeof createWorkspaceMember>>["user"];

let taskNumber = 0;
async function addTask(
  project: Project,
  title: string,
  position: number,
  column: keyof Project["columns"] = "todo",
) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.project.id,
      title,
      status: project.columns[column].slug,
      columnId: project.columns[column].id,
      number: ++taskNumber,
      position,
      priority: "low",
    })
    .returning();
  return task;
}

function client(user: User) {
  mockAuthenticatedSession(user);
  const { app } = createApp();
  return {
    lane: async (lane: string) => {
      const response = await app.request(
        `/api/task/global-board?globalStatus=${lane}`,
      );
      const body = (await response.json()) as { tasks: { title: string }[] };
      return body.tasks.map((task) => task.title);
    },
    move: (body: Record<string, unknown>) =>
      app.request("/api/task/global-board/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
  };
}

async function projectOrder(project: Project, status: string) {
  const rows = await db
    .select({ title: schema.taskTable.title })
    .from(schema.taskTable)
    .where(
      and(
        eq(schema.taskTable.projectId, project.project.id),
        eq(schema.taskTable.status, status),
      ),
    )
    .orderBy(schema.taskTable.position, schema.taskTable.id);
  return rows.map((row) => row.title);
}

describe("API integration: global board move", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    taskNumber = 0;
  });

  it("keeps a personal lane order and mirrors same-project order on the project board", async () => {
    const me = await createWorkspaceMember({ role: "admin" });
    const web = await createProjectFixture({ workspaceId: me.workspace.id });
    const ops = await createProjectFixture({ workspaceId: me.workspace.id });
    const w1 = await addTask(web, "W1", 0);
    const w2 = await addTask(web, "W2", 1);
    const o1 = await addTask(ops, "O1", 0);
    const api = client(me.user);

    // Arrange the lane as O1, W2, W1 by dragging W2 then W1.
    expect(
      (await api.move({ taskId: o1.id, visibleTaskIds: [o1.id, w1.id, w2.id] }))
        .status,
    ).toBe(200);
    await api.move({ taskId: w2.id, visibleTaskIds: [o1.id, w2.id, w1.id] });

    expect(await api.lane("to-do")).toEqual(["O1", "W2", "W1"]);
    expect(await projectOrder(web, "to-do")).toEqual(["W2", "W1"]);
    expect(await projectOrder(ops, "to-do")).toEqual(["O1"]);

    // Another member's board keeps its own order.
    const [teammate] = await db
      .insert(schema.userTable)
      .values({ id: "teammate", email: "t@example.com", name: "T" })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: me.workspace.id,
      userId: teammate.id,
      role: "member",
      joinedAt: new Date(),
    });
    expect((await client(teammate).lane("to-do")).sort()).toEqual([
      "O1",
      "W1",
      "W2",
    ]);
    const saved = await db
      .select()
      .from(schema.globalBoardOrderTable)
      .where(eq(schema.globalBoardOrderTable.userId, teammate.id));
    expect(saved).toEqual([]);
  });

  it("moves a card to another lane where it was dropped and auto-assigns", async () => {
    const me = await createWorkspaceMember({ role: "admin" });
    await db
      .update(schema.userTable)
      .set({ autoAssignSelf: true })
      .where(eq(schema.userTable.id, me.user.id));
    const web = await createProjectFixture({ workspaceId: me.workspace.id });
    const a = await addTask(web, "A", 0, "inProgress");
    const b = await addTask(web, "B", 1, "inProgress");
    const x = await addTask(web, "X", 0);
    const api = client(me.user);

    const response = await api.move({
      taskId: x.id,
      status: "in-progress",
      visibleTaskIds: [a.id, x.id, b.id],
    });
    expect(response.status).toBe(200);

    expect(await api.lane("in-progress")).toEqual(["A", "X", "B"]);
    expect(await projectOrder(web, "in-progress")).toEqual(["A", "X", "B"]);
    const [moved] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, x.id));
    expect(moved).toMatchObject({
      status: "in-progress",
      columnId: web.columns.inProgress.id,
      userId: me.user.id,
    });
  });

  it("lets viewers arrange their own board but not change projects", async () => {
    const owner = await createWorkspaceMember();
    const web = await createProjectFixture({ workspaceId: owner.workspace.id });
    const w1 = await addTask(web, "W1", 0);
    const w2 = await addTask(web, "W2", 1);
    const [viewer] = await db
      .insert(schema.userTable)
      .values({ id: "viewer", email: "v@example.com", name: "V" })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: owner.workspace.id,
      userId: viewer.id,
      role: "viewer",
      joinedAt: new Date(),
    });
    const api = client(viewer);

    expect(
      (await api.move({ taskId: w2.id, visibleTaskIds: [w2.id, w1.id] }))
        .status,
    ).toBe(200);
    expect(await api.lane("to-do")).toEqual(["W2", "W1"]);
    expect(await projectOrder(web, "to-do")).toEqual(["W1", "W2"]);

    expect(
      (
        await api.move({
          taskId: w2.id,
          status: "done",
          visibleTaskIds: [w2.id],
        })
      ).status,
    ).toBe(403);
  });

  it("ignores cards from workspaces the caller cannot see", async () => {
    const me = await createWorkspaceMember({ role: "admin" });
    const web = await createProjectFixture({ workspaceId: me.workspace.id });
    const mine = await addTask(web, "Mine", 0);
    const stranger = await createWorkspaceMember();
    const hidden = await addTask(
      await createProjectFixture({ workspaceId: stranger.workspace.id }),
      "Hidden",
      0,
    );
    const api = client(me.user);

    expect(
      (
        await api.move({
          taskId: mine.id,
          visibleTaskIds: [hidden.id, mine.id],
        })
      ).status,
    ).toBe(200);
    const saved = await db.select().from(schema.globalBoardOrderTable);
    expect(saved.map((row) => row.taskId)).toEqual([mine.id]);

    expect(
      (await api.move({ taskId: hidden.id, visibleTaskIds: [hidden.id] }))
        .status,
    ).toBe(404);
  });
});

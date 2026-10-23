import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";

type Project = Awaited<ReturnType<typeof createProjectFixture>>;

let taskNumber = 0;
async function addTask(
  project: Project,
  userId: string | null = null,
  column: keyof Project["columns"] = "todo",
) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.project.id,
      title: `Task ${++taskNumber}`,
      status: project.columns[column].slug,
      columnId: project.columns[column].id,
      number: 1000 + taskNumber,
      userId,
    })
    .returning();
  return task;
}

async function assigneeOf(taskId: string) {
  const [task] = await db
    .select({ userId: schema.taskTable.userId })
    .from(schema.taskTable)
    .where(eq(schema.taskTable.id, taskId));
  return task?.userId ?? null;
}

async function optIn(userId: string, on = true) {
  await db
    .update(schema.userTable)
    .set({ autoAssignSelf: on })
    .where(eq(schema.userTable.id, userId));
}

async function setup(role = "admin") {
  const me = await createWorkspaceMember({ role });
  const project = await createProjectFixture({ workspaceId: me.workspace.id });
  mockAuthenticatedSession(me.user);
  const { app } = createApp();
  const json = (method: string, path: string, body: unknown) =>
    app.request(`/api/task${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  return { me, project, json };
}

describe("API integration: auto-assign", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    taskNumber = 0;
  });

  it("does nothing until the user opts in", async () => {
    const { project, json } = await setup();
    const created = await json("POST", `/${project.project.id}`, {
      title: "New",
      description: "",
      status: "to-do",
      priority: "low",
    });
    expect(created.status).toBe(200);
    expect(
      await assigneeOf(((await created.json()) as { id: string }).id),
    ).toBeNull();

    const task = await addTask(project);
    expect(
      (await json("PUT", `/status/${task.id}`, { status: "done" })).status,
    ).toBe(200);
    expect(await assigneeOf(task.id)).toBeNull();
  });

  it("assigns the creator unless the request says unassigned or names someone", async () => {
    const { me, project, json } = await setup();
    const teammate = await addWorkspaceMember(me.workspace.id);
    await optIn(me.user.id);
    const create = async (extra: Record<string, unknown>) =>
      (
        (await (
          await json("POST", `/${project.project.id}`, {
            title: "New",
            description: "",
            status: "to-do",
            priority: "low",
            ...extra,
          })
        ).json()) as { userId: string | null }
      ).userId;

    expect(await create({})).toBe(me.user.id);
    expect(await create({ userId: null })).toBeNull();
    expect(await create({ userId: teammate.id })).toBe(teammate.id);
  });

  it("assigns the mover only when the task changes column and is unassigned", async () => {
    const { me, project, json } = await setup();
    const teammate = await addWorkspaceMember(me.workspace.id);
    await optIn(me.user.id);
    const unassigned = await addTask(project);
    const theirs = await addTask(project, teammate.id);
    const stays = await addTask(project);

    await json("PUT", `/status/${unassigned.id}`, { status: "in-progress" });
    await json("PUT", `/status/${theirs.id}`, { status: "in-progress" });
    await json("PUT", `/status/${stays.id}`, { status: "to-do" });

    expect(await assigneeOf(unassigned.id)).toBe(me.user.id);
    expect(await assigneeOf(theirs.id)).toBe(teammate.id);
    expect(await assigneeOf(stays.id)).toBeNull();
  });

  it("leaves tasks sent to the backlog or archive unassigned", async () => {
    const { project, json, me } = await setup();
    await optIn(me.user.id);
    const backlog = await addTask(project);
    const archived = await addTask(project);

    expect(
      (await json("PUT", `/status/${backlog.id}`, { status: "planned" }))
        .status,
    ).toBe(200);
    await json("PUT", `/status/${archived.id}`, { status: "archived" });

    expect(await assigneeOf(backlog.id)).toBeNull();
    expect(await assigneeOf(archived.id)).toBeNull();
  });

  it("assigns cards dragged to another column on the project board", async () => {
    const { me, project, json } = await setup();
    await optIn(me.user.id);
    const moved = await addTask(project);
    const reordered = await addTask(project);

    const response = await json("POST", "/reorder", {
      projectId: project.project.id,
      tasks: [
        { id: moved.id, position: 0, status: "in-review" },
        { id: reordered.id, position: 5 },
      ],
    });
    expect(response.status).toBe(200);
    expect(await assigneeOf(moved.id)).toBe(me.user.id);
    expect(await assigneeOf(reordered.id)).toBeNull();
  });

  it("never assigns where the caller's role cannot assign tasks", async () => {
    const { me, project, json } = await setup("member");
    await optIn(me.user.id);
    const task = await addTask(project);

    expect(
      (await json("PUT", `/status/${task.id}`, { status: "done" })).status,
    ).toBe(200);
    expect(await assigneeOf(task.id)).toBeNull();

    const created = await json("POST", `/${project.project.id}`, {
      title: "New",
      description: "",
      status: "to-do",
      priority: "low",
    });
    expect(created.status).toBe(200);
    expect(
      await assigneeOf(((await created.json()) as { id: string }).id),
    ).toBeNull();
  });
});

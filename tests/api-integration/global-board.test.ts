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
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

type Project = Awaited<ReturnType<typeof createProjectFixture>>;

type BoardPage = {
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    statusName: string | null;
    projectName: string;
    workspaceName: string;
    assignee: { id: string } | null;
    labels: Array<{ name: string }>;
  }>;
  pagination: { page: number; total: number; totalPages: number };
};

type BoardMeta = {
  workspaces: Array<{ id: string; canMoveTasks: boolean }>;
  projects: Array<{
    id: string;
    columns: Array<{ slug: string; globalStatus: string | null }>;
  }>;
  assignees: Array<{ id: string }>;
  labels: Array<{ name: string }>;
};

let taskNumber = 0;
async function addTask(
  project: Project,
  title: string,
  column: keyof Project["columns"] | "planned" | "archived",
  extra: Partial<typeof schema.taskTable.$inferInsert> = {},
) {
  const target =
    column in project.columns
      ? project.columns[column as keyof Project["columns"]]
      : null;
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.project.id,
      title,
      status: target?.slug ?? column,
      columnId: target?.id ?? null,
      number: ++taskNumber,
      ...extra,
    })
    .returning();
  return task;
}

async function board(app: ReturnType<typeof createApp>["app"], query: string) {
  const response = await app.request(`/api/task/global-board?${query}`);
  expect(response.status).toBe(200);
  return (await response.json()) as BoardPage;
}

const titles = (page: BoardPage) => page.tasks.map((task) => task.title).sort();

describe("API integration: global board", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    taskNumber = 0;
  });

  it("shows tasks from every readable workspace and project, and nothing else", async () => {
    const me = await createWorkspaceMember({ workspaceName: "Agency" });
    const agencyWeb = await createProjectFixture({
      workspaceId: me.workspace.id,
      name: "Web",
      slug: "web",
    });
    const agencyHidden = await createProjectFixture({
      workspaceId: me.workspace.id,
      name: "Hidden",
      slug: "hid",
    });
    const agencyArchived = await createProjectFixture({
      workspaceId: me.workspace.id,
      slug: "old",
    });
    await db
      .update(schema.projectTable)
      .set({ archivedAt: new Date() })
      .where(eq(schema.projectTable.id, agencyArchived.project.id));
    await restrictToProjects(me.workspace.id, me.user.id, [
      agencyWeb.project.id,
    ]);

    // A second workspace where the caller only views.
    const client = await createWorkspaceMember({ workspaceName: "Client" });
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: client.workspace.id,
      userId: me.user.id,
      role: "viewer",
      joinedAt: new Date(),
    });
    const clientApp = await createProjectFixture({
      workspaceId: client.workspace.id,
      name: "App",
      slug: "app",
    });

    // A workspace the caller does not belong to.
    const stranger = await createWorkspaceMember({ workspaceName: "Other" });
    const strangerProject = await createProjectFixture({
      workspaceId: stranger.workspace.id,
      slug: "x",
    });

    await addTask(agencyWeb, "Visible web task", "todo");
    await addTask(agencyWeb, "Planned task", "planned");
    await addTask(agencyWeb, "Archived task", "archived");
    await addTask(agencyHidden, "Restricted project task", "todo");
    await addTask(agencyArchived, "Archived project task", "todo");
    await addTask(clientApp, "Client task", "todo");
    await addTask(strangerProject, "Stranger task", "todo");

    mockAuthenticatedSession(me.user);
    const { app } = createApp();

    const todo = await board(app, "globalStatus=to-do");
    expect(titles(todo)).toEqual(["Client task", "Visible web task"]);
    expect(
      todo.tasks.find((task) => task.title === "Client task"),
    ).toMatchObject({ projectName: "App", workspaceName: "Client" });

    const metaResponse = await app.request("/api/task/global-board/meta");
    expect(metaResponse.status).toBe(200);
    const meta = (await metaResponse.json()) as BoardMeta;
    expect(
      Object.fromEntries(
        meta.workspaces.map((workspace) => [
          workspace.id,
          workspace.canMoveTasks,
        ]),
      ),
    ).toEqual({ [me.workspace.id]: true, [client.workspace.id]: false });
    expect(meta.projects.map((project) => project.id).sort()).toEqual(
      [agencyWeb.project.id, clientApp.project.id].sort(),
    );

    // Filtering to a workspace or project outside the caller's reach is empty.
    expect(
      (
        await board(
          app,
          `globalStatus=to-do&workspaceId=${stranger.workspace.id}`,
        )
      ).tasks,
    ).toEqual([]);
    expect(
      (
        await board(
          app,
          `globalStatus=to-do&projectId=${agencyHidden.project.id}`,
        )
      ).tasks,
    ).toEqual([]);
  });

  it("drops workspaces whose role cannot read tasks", async () => {
    const me = await createWorkspaceMember();
    const project = await createProjectFixture({
      workspaceId: me.workspace.id,
    });
    await addTask(project, "Secret", "todo");
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: me.workspace.id,
      role: "no-tasks",
      permission: JSON.stringify({ workspace: ["read"], project: ["read"] }),
    });
    await db
      .update(schema.workspaceUserTable)
      .set({ role: "no-tasks" })
      .where(eq(schema.workspaceUserTable.userId, me.user.id));

    mockAuthenticatedSession(me.user);
    const { app } = createApp();

    expect((await board(app, "globalStatus=to-do")).tasks).toEqual([]);
    const meta = (await (
      await app.request("/api/task/global-board/meta")
    ).json()) as BoardMeta;
    expect(meta.workspaces).toEqual([]);
  });

  it("maps project columns onto the global statuses and isolates ambiguous ones", async () => {
    const me = await createWorkspaceMember();
    const project = await createProjectFixture({
      workspaceId: me.workspace.id,
    });
    const [misnamed] = await db
      .insert(schema.columnTable)
      .values({
        projectId: project.project.id,
        name: "Completed",
        slug: "completed",
        position: 4,
        isFinal: false,
      })
      .returning();

    await addTask(project, "Todo", "todo");
    await addTask(project, "Doing", "inProgress");
    await addTask(project, "Reviewing", "inReview");
    await addTask(project, "Finished", "done");
    await addTask(project, "Misfiled", "todo", {
      status: misnamed.slug,
      columnId: misnamed.id,
    });
    await addTask(project, "Orphaned", "todo", {
      status: "deleted-column",
      columnId: null,
    });

    mockAuthenticatedSession(me.user);
    const { app } = createApp();

    expect(titles(await board(app, "globalStatus=to-do"))).toEqual(["Todo"]);
    expect(titles(await board(app, "globalStatus=in-progress"))).toEqual([
      "Doing",
      "Reviewing",
    ]);
    expect(titles(await board(app, "globalStatus=done"))).toEqual(["Finished"]);
    expect(titles(await board(app, "globalStatus=unmapped"))).toEqual([
      "Misfiled",
      "Orphaned",
    ]);

    const meta = (await (
      await app.request("/api/task/global-board/meta")
    ).json()) as BoardMeta;
    expect(
      Object.fromEntries(
        meta.projects[0]?.columns.map((column) => [
          column.slug,
          column.globalStatus,
        ]) ?? [],
      ),
    ).toEqual({
      "to-do": "to-do",
      "in-progress": "in-progress",
      "in-review": "in-progress",
      done: "done",
      completed: null,
    });
  });

  it("filters by workspace, project, assignee, priority, label, and text", async () => {
    const me = await createWorkspaceMember();
    const teammate = await addWorkspaceMember(me.workspace.id);
    const web = await createProjectFixture({
      workspaceId: me.workspace.id,
      slug: "web",
    });
    const api = await createProjectFixture({
      workspaceId: me.workspace.id,
      slug: "api",
    });
    const second = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: second.workspace.id,
      userId: me.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    const elsewhere = await createProjectFixture({
      workspaceId: second.workspace.id,
      slug: "ext",
    });

    const mine = await addTask(web, "Fix login bug", "todo", {
      userId: me.user.id,
      priority: "urgent",
    });
    const theirs = await addTask(api, "Write docs", "todo", {
      userId: teammate.id,
      priority: "low",
    });
    const nobody = await addTask(elsewhere, "Plan launch", "todo", {
      priority: "medium",
    });
    await db.insert(schema.labelTable).values({
      name: "Bug",
      color: "red",
      taskId: mine.id,
      workspaceId: me.workspace.id,
    });

    mockAuthenticatedSession(me.user);
    const { app } = createApp();
    const ids = async (query: string) =>
      (await board(app, `globalStatus=to-do&${query}`)).tasks.map(
        (task) => task.id,
      );

    expect(await ids(`workspaceId=${second.workspace.id}`)).toEqual([
      nobody.id,
    ]);
    expect(await ids(`projectId=${api.project.id}`)).toEqual([theirs.id]);
    expect(await ids("assigneeId=me")).toEqual([mine.id]);
    expect(await ids(`assigneeId=${teammate.id}`)).toEqual([theirs.id]);
    expect(await ids("assigneeId=unassigned")).toEqual([nobody.id]);
    expect(await ids("priority=low")).toEqual([theirs.id]);
    expect(await ids("label=bug")).toEqual([mine.id]);
    expect(await ids("q=LOGIN")).toEqual([mine.id]);
    expect(await ids(`q=API-${theirs.number}`)).toEqual([theirs.id]);
    expect(await ids("q=100%25")).toEqual([]);
    // Ordered by priority when unfiltered.
    expect(await ids("")).toEqual([mine.id, nobody.id, theirs.id]);

    const invalid = await app.request(
      "/api/task/global-board?globalStatus=to-do&priority=critical",
    );
    expect(invalid.status).toBe(400);
  });

  it("pages through a column", async () => {
    const me = await createWorkspaceMember();
    const project = await createProjectFixture({
      workspaceId: me.workspace.id,
    });
    for (let index = 0; index < 5; index++)
      await addTask(project, `Task ${index}`, "todo");

    mockAuthenticatedSession(me.user);
    const { app } = createApp();

    const first = await board(app, "globalStatus=to-do&limit=2");
    const last = await board(app, "globalStatus=to-do&limit=2&page=3");
    expect(first.pagination).toMatchObject({
      page: 1,
      total: 5,
      totalPages: 3,
    });
    expect(first.tasks).toHaveLength(2);
    expect(last.tasks).toHaveLength(1);
    expect(
      (await app.request("/api/task/global-board?globalStatus=to-do&limit=101"))
        .status,
    ).toBe(400);
  });

  it("moves a task between global columns only where the caller may update it", async () => {
    const me = await createWorkspaceMember();
    const project = await createProjectFixture({
      workspaceId: me.workspace.id,
    });
    const task = await addTask(project, "Drag me", "todo");

    const viewerWorkspace = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: viewerWorkspace.workspace.id,
      userId: me.user.id,
      role: "viewer",
      joinedAt: new Date(),
    });
    const readOnly = await createProjectFixture({
      workspaceId: viewerWorkspace.workspace.id,
    });
    const readOnlyTask = await addTask(readOnly, "Look only", "todo");

    mockAuthenticatedSession(me.user);
    const { app } = createApp();
    const move = (id: string, status: string) =>
      app.request(`/api/task/status/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

    expect((await move(task.id, "in-review")).status).toBe(200);
    expect(titles(await board(app, "globalStatus=in-progress"))).toEqual([
      "Drag me",
    ]);
    const [stored] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, task.id));
    expect(stored).toMatchObject({
      status: "in-review",
      columnId: project.columns.inReview.id,
    });

    expect((await move(readOnlyTask.id, "done")).status).toBe(403);
    expect(titles(await board(app, "globalStatus=done"))).toEqual([]);
  });
});

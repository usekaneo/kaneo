import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { createRestrictedWorkspace } from "./helpers/project-access/create-restricted-workspace";

type BoardTask = {
  id: string;
  title: string;
  status: string;
  projectId: string;
  projectSlug: string;
  projectName: string;
  userId: string | null;
  labels: Array<{ id: string; name: string }>;
  subtaskCounts: { completed: number; total: number };
};

type BoardResponse = {
  data: {
    id: string;
    workspaceId: string;
    columns: Array<{
      id: string;
      slug: string;
      name: string;
      isFinal: boolean;
      tasks: BoardTask[];
    }>;
    archivedTasks: BoardTask[];
    plannedTasks: BoardTask[];
    projects: Array<{
      id: string;
      slug: string;
      columnSlugs: string[];
      finalColumnSlugs: string[];
    }>;
  };
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
};

function flatten(body: BoardResponse) {
  return body.data.columns.flatMap((column) => column.tasks);
}

async function request(path: string) {
  const { app } = createApp();
  return app.request(`/api/task/workspace-board${path}`);
}

async function board(path: string) {
  const response = await request(path);
  expect(response.status).toBe(200);
  return (await response.json()) as BoardResponse;
}

describe("API integration: workspace board", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects anonymous callers", async () => {
    mockAnonymousSession();
    const response = await request("?workspaceId=anything");
    expect(response.status).toBe(401);
  });

  it("refuses a workspace the caller does not belong to", async () => {
    const member = await createWorkspaceMember();
    const outsider = await createWorkspaceMember();
    mockAuthenticatedSession(outsider.user);
    const response = await request(`?workspaceId=${member.workspace.id}`);
    expect(response.status).toBe(404);
  });

  it.each([
    { workspace: ["read"] },
    { workspace: ["read"], project: ["read"] },
    { workspace: ["read"], task: ["read"] },
  ])(
    "rejects members missing project or task read (%j)",
    async (permissions) => {
      const member = await createWorkspaceMember({ role: "limited" });
      await db.insert(schema.workspaceRoleTable).values({
        workspaceId: member.workspace.id,
        role: "limited",
        permission: JSON.stringify(permissions),
      });
      mockAuthenticatedSession(member.user);
      const response = await request(`?workspaceId=${member.workspace.id}`);
      expect(response.status).toBe(403);
    },
  );

  it("merges open tasks of every active project into slug columns", async () => {
    const member = await createWorkspaceMember();
    const other = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: member.workspace.id,
      userId: other.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    const web = await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "Web",
      slug: "web",
    });
    const api = await createProjectFixture({
      workspaceId: member.workspace.id,
      name: "API",
      slug: "api",
    });
    const archived = await createProjectFixture({
      workspaceId: member.workspace.id,
      slug: "old",
    });
    await db
      .update(schema.projectTable)
      .set({ archivedAt: new Date() })
      .where(eq(schema.projectTable.id, archived.project.id));
    // A workflow column only the API project has.
    const [qa] = await db
      .insert(schema.columnTable)
      .values({
        projectId: api.project.id,
        name: "QA",
        slug: "qa",
        position: 2,
        isFinal: false,
      })
      .returning();

    const base = { priority: "medium", position: 1 };
    const [webTodo, apiProgress, apiQa] = await db
      .insert(schema.taskTable)
      .values([
        {
          ...base,
          projectId: web.project.id,
          title: "Web todo",
          status: "to-do",
          columnId: web.columns.todo.id,
          userId: member.user.id,
          number: 1,
          dueDate: new Date("2030-02-01T00:00:00.000Z"),
        },
        {
          ...base,
          projectId: api.project.id,
          title: "API in progress",
          status: "in-progress",
          columnId: api.columns.inProgress.id,
          userId: other.user.id,
          number: 1,
          dueDate: new Date("2030-01-01T00:00:00.000Z"),
        },
        {
          ...base,
          projectId: api.project.id,
          title: "API in QA",
          status: "qa",
          columnId: qa.id,
          number: 2,
        },
        {
          ...base,
          projectId: web.project.id,
          title: "Web done",
          status: "done",
          columnId: web.columns.done.id,
          userId: member.user.id,
          number: 2,
        },
        {
          ...base,
          projectId: web.project.id,
          title: "Web archived",
          status: "archived",
          number: 3,
        },
        {
          ...base,
          projectId: archived.project.id,
          title: "In archived project",
          status: "to-do",
          columnId: archived.columns.todo.id,
          number: 1,
        },
      ])
      .returning();
    await db.insert(schema.labelTable).values({
      name: "Bug",
      color: "red",
      taskId: apiProgress.id,
      workspaceId: member.workspace.id,
    });

    mockAuthenticatedSession(member.user);
    const body = await board(`?workspaceId=${member.workspace.id}`);

    expect(body.data.id).toBe(`workspace-board:${member.workspace.id}`);
    expect(body.pagination).toEqual({
      total: 3,
      page: 1,
      pageSize: 50,
      totalPages: 1,
    });
    expect(body.data.columns.map((column) => column.slug)).toEqual([
      "to-do",
      "in-progress",
      "in-review",
      "qa",
      "done",
    ]);
    // Flattened in column order; the due-date sort shows in the paging below.
    expect(flatten(body).map((task) => task.id)).toEqual([
      webTodo.id,
      apiProgress.id,
      apiQa.id,
    ]);
    expect(flatten(body)[1]).toMatchObject({
      projectSlug: "api",
      projectName: "API",
      labels: [expect.objectContaining({ name: "Bug" })],
      subtaskCounts: { completed: 0, total: 0 },
    });
    expect(body.data.archivedTasks).toEqual([]);
    expect(body.data.plannedTasks).toEqual([]);
    expect(body.data.projects.map((project) => project.slug)).toEqual([
      "api",
      "web",
    ]);
    expect(
      body.data.projects.find((project) => project.slug === "api")?.columnSlugs,
    ).toEqual(["to-do", "in-progress", "in-review", "qa", "done"]);
    expect(
      body.data.projects.find((project) => project.slug === "api")
        ?.finalColumnSlugs,
    ).toEqual(["done"]);

    const completed = await board(
      `?workspaceId=${member.workspace.id}&includeCompleted=true`,
    );
    expect(completed.pagination.total).toBe(4);
    expect(
      completed.data.columns.find((column) => column.slug === "done")?.tasks,
    ).toEqual([expect.objectContaining({ title: "Web done" })]);

    const mine = await board(
      `?workspaceId=${member.workspace.id}&assigneeIds=${member.user.id}`,
    );
    expect(flatten(mine).map((task) => task.id)).toEqual([webTodo.id]);

    const unassigned = await board(
      `?workspaceId=${member.workspace.id}&assigneeIds=unassigned`,
    );
    expect(flatten(unassigned).map((task) => task.id)).toEqual([apiQa.id]);

    const both = await board(
      `?workspaceId=${member.workspace.id}&assigneeIds=unassigned,${member.user.id}`,
    );
    expect(both.pagination.total).toBe(2);

    const labelId = flatten(body)[1].labels[0].id;
    const labelled = await board(
      `?workspaceId=${member.workspace.id}&labelIds=${labelId}`,
    );
    expect(flatten(labelled).map((task) => task.id)).toEqual([apiProgress.id]);

    // The workspace-level label stands for every task copy with its name and
    // color, so a filter needs one id per label instead of one per task.
    const [workspaceBug, foreignBug] = await db
      .insert(schema.labelTable)
      .values([
        { name: "Bug", color: "red", workspaceId: member.workspace.id },
        { name: "Bug", color: "red", workspaceId: other.workspace.id },
      ])
      .returning();
    const byGroup = await board(
      `?workspaceId=${member.workspace.id}&labelIds=${workspaceBug.id}`,
    );
    expect(flatten(byGroup).map((task) => task.id)).toEqual([apiProgress.id]);
    const byForeignLabel = await board(
      `?workspaceId=${member.workspace.id}&labelIds=${foreignBug.id}`,
    );
    expect(byForeignLabel.pagination.total).toBe(0);

    const onlyWeb = await board(
      `?workspaceId=${member.workspace.id}&projectIds=${web.project.id}`,
    );
    expect(flatten(onlyWeb).map((task) => task.id)).toEqual([webTodo.id]);
    expect(onlyWeb.data.projects).toHaveLength(2);
    // Lanes follow the projects in scope; QA only exists in the API project.
    expect(onlyWeb.data.columns.map((column) => column.slug)).toEqual([
      "to-do",
      "in-progress",
      "in-review",
      "done",
    ]);
    expect(
      onlyWeb.data.projects.find((project) => project.slug === "api")
        ?.columnSlugs,
    ).toContain("qa");

    const byStatus = await board(
      `?workspaceId=${member.workspace.id}&status=qa,in-progress`,
    );
    expect(byStatus.pagination.total).toBe(2);

    const dueSoon = await board(
      `?workspaceId=${member.workspace.id}&dueAfter=2029-12-01T00:00:00.000Z&dueBefore=2030-01-15T00:00:00.000Z`,
    );
    expect(flatten(dueSoon).map((task) => task.id)).toEqual([apiProgress.id]);

    const pages = await Promise.all(
      [1, 2, 3].map((page) =>
        board(`?workspaceId=${member.workspace.id}&limit=1&page=${page}`),
      ),
    );
    expect(pages[1].pagination).toEqual({
      total: 3,
      page: 2,
      pageSize: 1,
      totalPages: 3,
    });
    // Soonest due first, undated last.
    expect(pages.map((page) => flatten(page).map((task) => task.id))).toEqual([
      [apiProgress.id],
      [webTodo.id],
      [apiQa.id],
    ]);
  });

  it("hides projects, columns and counts a restricted member cannot access", async () => {
    const ctx = await createRestrictedWorkspace();
    const [betaOnly] = await db
      .insert(schema.columnTable)
      .values({
        projectId: ctx.beta.id,
        name: "Beta secret",
        slug: "beta-secret",
        position: 9,
        isFinal: false,
      })
      .returning();
    await db.insert(schema.taskTable).values({
      projectId: ctx.beta.id,
      title: "Hidden in secret column",
      status: betaOnly.slug,
      columnId: betaOnly.id,
      userId: ctx.restricted.id,
      number: 2,
    });

    mockAuthenticatedSession(ctx.restricted);
    const body = await board(`?workspaceId=${ctx.workspace.id}`);
    expect(body.pagination.total).toBe(1);
    expect(flatten(body).map((task) => task.id)).toEqual([ctx.alphaTask.id]);
    expect(body.data.projects.map((project) => project.id)).toEqual([
      ctx.alpha.id,
    ]);
    expect(body.data.columns.map((column) => column.slug)).not.toContain(
      betaOnly.slug,
    );

    // Asking for the hidden project explicitly reveals nothing either.
    const forced = await board(
      `?workspaceId=${ctx.workspace.id}&projectIds=${ctx.beta.id}`,
    );
    expect(forced.pagination.total).toBe(0);
    expect(flatten(forced)).toEqual([]);

    mockAuthenticatedSession(ctx.owner);
    const ownerView = await board(`?workspaceId=${ctx.workspace.id}`);
    expect(ownerView.pagination.total).toBe(3);
    expect(ownerView.data.projects.map((project) => project.id).sort()).toEqual(
      [ctx.alpha.id, ctx.beta.id].sort(),
    );
  });

  it("rejects malformed query parameters", async () => {
    const member = await createWorkspaceMember();
    mockAuthenticatedSession(member.user);
    for (const query of [
      "&limit=0",
      "&limit=abc",
      "&page=0",
      "&dueBefore=nope",
    ]) {
      const response = await request(
        `?workspaceId=${member.workspace.id}${query}`,
      );
      expect({ query, status: response.status }).toEqual({
        query,
        status: 400,
      });
    }
  });
});

import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type {
  ImportedProject,
  ImportSource,
  ReadProjectOptions,
} from "../../packages/importers/dist/index.js";
import db, { schema } from "../../apps/api/src/database";
import { waitForActiveImports } from "../../apps/api/src/import/active-imports";
import { writeImportRelations } from "../../apps/api/src/import/writer/write-import-relations";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { readErrorBody } from "./helpers/error-body";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const importers = vi.hoisted(() => ({ connectSource: vi.fn() }));
vi.mock("../../packages/importers/dist/index.js", async (original) => ({
  ...(await original<
    typeof import("../../packages/importers/dist/index.js")
  >()),
  connectSource: importers.connectSource,
}));

vi.mock(
  "../../apps/api/src/import/writer/write-import-relations",
  async (original) => {
    const actual =
      await original<
        typeof import("../../apps/api/src/import/writer/write-import-relations")
      >();
    return {
      ...actual,
      writeImportRelations: vi.fn(actual.writeImportRelations),
    };
  },
);

const SECRET = "planka-secret-key-0123456789";

const connection = {
  source: "planka",
  url: "https://planka.example.com",
  apiKey: SECRET,
};

function plankaProject(memberEmail: string): ImportedProject {
  return {
    name: "Website Relaunch",
    description: "Everything for the relaunch",
    columns: [
      { key: "c1", name: "Backlog", isFinal: false },
      { key: "c2", name: "Doing", isFinal: false },
      { key: "c3", name: "Shipped", isFinal: true },
      { key: "c4", name: "Planned", isFinal: false },
    ],
    labels: [
      { key: "l1", name: "Bug", color: "red" },
      { key: "l2", name: "Design", color: "purple" },
      { key: "l3", name: "Unused", color: "gray" },
    ],
    tasks: [
      {
        key: "t1",
        columnKey: "c1",
        title: "Write the copy",
        description: "Draft **all** pages",
        priority: "high",
        createdAt: "2023-05-06T07:08:09.000Z",
        dueDate: "2024-02-01T00:00:00.000Z",
        assignee: { name: "Mira", email: memberEmail.toUpperCase() },
        labelKeys: ["l1", "l2", "l1"],
        comments: [
          {
            author: { name: "Ana" },
            body: "Looks good",
            createdAt: "2024-01-02T03:04:05.000Z",
          },
          { author: {}, body: "No author" },
          { author: { name: "Empty" }, body: "   " },
        ],
      },
      {
        key: "t2",
        columnKey: "c1",
        title: "   ",
        description: "",
        priority: "bogus" as ImportedProject["tasks"][number]["priority"],
        assignee: { name: "Stranger", email: "stranger@example.com" },
        labelKeys: [],
        comments: [],
      },
      {
        key: "t3",
        columnKey: null,
        title: "Someday",
        description: "",
        priority: "low",
        labelKeys: [],
        comments: [],
      },
      {
        key: "t4",
        columnKey: "c3",
        archived: true,
        title: "Old launch",
        description: "",
        priority: "no-priority",
        labelKeys: [],
        comments: [],
      },
      {
        key: "t5",
        columnKey: "c3",
        title: "Ship it",
        description: "",
        priority: "urgent",
        labelKeys: ["l1"],
        comments: [],
      },
    ],
    relations: [
      { sourceKey: "t1", targetKey: "t5", type: "subtask" },
      { sourceKey: "t5", targetKey: "t1", type: "subtask" },
      { sourceKey: "t2", targetKey: "t2", type: "related" },
      { sourceKey: "t1", targetKey: "t3", type: "blocks" },
    ],
    warnings: ["2 attachments were skipped."],
  };
}

function numberedProject(): ImportedProject {
  const task = (key: string, title: string, number?: number) => ({
    key,
    ...(number === undefined ? {} : { number }),
    columnKey: "c1",
    title,
    description: "",
    priority: "no-priority" as const,
    labelKeys: [],
    comments: [],
  });
  return {
    name: "Engineering",
    key: "eng",
    columns: [{ key: "c1", name: "To Do", isFinal: false }],
    labels: [],
    tasks: [
      task("a", "Seven", 7),
      task("b", "No number"),
      task("c", "Three", 3),
      task("d", "Another seven", 7),
    ],
    relations: [],
    warnings: [],
  };
}

function fakeSource(
  read: (id: string, options: ReadProjectOptions) => Promise<ImportedProject>,
): ImportSource {
  return {
    listProjects: vi.fn(async () => [
      { id: "p1", name: "Website Relaunch", detail: "Marketing" },
      { id: "p2", name: "Broken board" },
    ]),
    readProject: vi.fn(read),
  };
}

class SourceHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SourceHttpError";
  }
}

async function createAdmin() {
  return createWorkspaceMember({ role: "admin", userName: "Importer" });
}

async function addMember(workspaceId: string, name: string, role = "member") {
  const id = `user-${randomUUID()}`;
  const [user] = await db
    .insert(schema.userTable)
    .values({ id, email: `${id}@example.com`, emailVerified: true, name })
    .returning();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: id,
    role,
    joinedAt: new Date(),
  });
  return user;
}

function post(path: string, body: unknown) {
  return createApp().app.request(`/api/import${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function get(path: string) {
  return createApp().app.request(`/api/import${path}`);
}

async function importProject(workspaceId: string) {
  const started = await post("/runs", {
    workspaceId,
    connection,
    projectIds: ["p1"],
  });
  expect(started.status).toBe(202);
  const { run } = (await started.json()) as { run: { id: string } };
  await waitForActiveImports();

  const polled = await get(`/runs/${workspaceId}/${run.id}`);
  const { run: finished } = (await polled.json()) as {
    run: {
      projects: {
        status: string;
        projectId: string | null;
        projectSlug: string | null;
      }[];
    };
  };
  const [imported] = finished.projects;
  expect(imported?.status).toBe("completed");
  return imported as { projectId: string; projectSlug: string };
}

describe("API integration: import from other tools", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    importers.connectSource.mockReset();
  });

  it("lists the projects of a source without echoing credentials", async () => {
    const admin = await createAdmin();
    importers.connectSource.mockResolvedValue(
      fakeSource(async () => plankaProject("")),
    );
    mockAuthenticatedSession(admin.user);

    const response = await post("/projects", {
      workspaceId: admin.workspace.id,
      connection,
    });

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({
      projects: [
        { id: "p1", name: "Website Relaunch", detail: "Marketing" },
        { id: "p2", name: "Broken board" },
      ],
    });
    expect(text).not.toContain(SECRET);
    expect(importers.connectSource).toHaveBeenCalledWith(
      connection,
      expect.objectContaining({
        fetch: expect.any(Function),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("explains rejected credentials", async () => {
    const admin = await createAdmin();
    importers.connectSource.mockRejectedValue(
      new SourceHttpError(`PLANKA /api/users/me: unauthorized ${SECRET}`, 401),
    );
    mockAuthenticatedSession(admin.user);

    const response = await post("/projects", {
      workspaceId: admin.workspace.id,
      connection,
    });

    expect(response.status).toBe(400);
    const body = await readErrorBody(response);
    expect(body.message).toBe(
      "Could not sign in to PLANKA. Check the API key.",
    );
  });

  it("asks for a Trello API key when the server has none", async () => {
    vi.stubEnv("TRELLO_API_KEY", "");
    const admin = await createAdmin();
    mockAuthenticatedSession(admin.user);

    const response = await post("/projects", {
      workspaceId: admin.workspace.id,
      connection: { source: "trello", token: "trello-token-123456" },
    });

    expect(response.status).toBe(400);
    expect((await readErrorBody(response)).message).toBe(
      "Add a Trello API key.",
    );
    expect(importers.connectSource).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("imports projects in the background and reports each one", async () => {
    const admin = await createAdmin();
    const workspaceId = admin.workspace.id;
    const member = await addMember(workspaceId, "Mira");
    await db.insert(schema.labelTable).values({
      name: "Bug",
      color: "#123456",
      workspaceId,
      taskId: null,
    });
    const source = fakeSource(async (id, options) => {
      options.onProgress?.("Reading cards (1 of 5)");
      if (id === "p2") {
        throw new SourceHttpError("PLANKA /api/boards/p2: boom", 500);
      }
      expect(options.includeComments).toBe(true);
      return plankaProject(member.email);
    });
    importers.connectSource.mockResolvedValue(source);
    mockAuthenticatedSession(admin.user);

    const started = await post("/runs", {
      workspaceId,
      connection,
      projectIds: ["p2", "p1"],
    });
    expect(started.status).toBe(202);
    const { run } = (await started.json()) as {
      run: { id: string; status: string; projects: { name: string }[] };
    };
    expect(run.status).toBe("running");
    expect(run.projects.map((project) => project.name)).toEqual([
      "Broken board",
      "Website Relaunch",
    ]);

    await waitForActiveImports();

    const polled = await get(`/runs/${workspaceId}/${run.id}`);
    expect(polled.status).toBe(200);
    const { run: finished } = (await polled.json()) as {
      run: {
        status: string;
        error: string | null;
        message: string | null;
        finishedAt: string | null;
        projects: {
          sourceId: string;
          status: string;
          projectId: string | null;
          projectSlug: string | null;
          counts: Record<string, number>;
          warnings: string[];
          error: string | null;
        }[];
      };
    };
    expect(finished).toMatchObject({
      status: "completed",
      error: null,
      message: null,
    });
    expect(finished.finishedAt).not.toBeNull();
    const [broken, imported] = finished.projects;
    expect(broken).toMatchObject({
      sourceId: "p2",
      status: "failed",
      projectId: null,
      error: "PLANKA returned an error (HTTP 500). Try again later.",
    });
    expect(imported).toMatchObject({
      sourceId: "p1",
      status: "completed",
      projectSlug: "WR",
      error: null,
      counts: {
        columns: 4,
        tasks: 5,
        labels: 2,
        comments: 2,
        assignees: 1,
        relations: 2,
      },
    });
    expect(imported?.warnings).toEqual([
      "2 attachments were skipped.",
      'Renamed a column to avoid conflicts: "Planned" to "Planned list".',
      "1 task was assigned to someone who is not a member of this workspace (Stranger). Invite them, then assign the task.",
    ]);

    const projectId = imported?.projectId ?? "";
    const [project] = await db
      .select()
      .from(schema.projectTable)
      .where(eq(schema.projectTable.workspaceId, workspaceId));
    expect(project).toMatchObject({
      id: projectId,
      name: "Website Relaunch",
      slug: "WR",
      description: "Everything for the relaunch",
      lastTaskNumber: 5,
    });

    const columns = await db
      .select()
      .from(schema.columnTable)
      .where(eq(schema.columnTable.projectId, projectId))
      .orderBy(asc(schema.columnTable.position));
    expect(
      columns.map(({ name, slug, position, isFinal }) => ({
        name,
        slug,
        position,
        isFinal,
      })),
    ).toEqual([
      { name: "Backlog", slug: "backlog", position: 0, isFinal: false },
      { name: "Doing", slug: "doing", position: 1, isFinal: false },
      { name: "Shipped", slug: "shipped", position: 2, isFinal: true },
      {
        name: "Planned list",
        slug: "planned-list",
        position: 3,
        isFinal: false,
      },
    ]);
    const columnId = (slug: string) =>
      columns.find((column) => column.slug === slug)?.id;

    const tasks = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.projectId, projectId))
      .orderBy(asc(schema.taskTable.number));
    expect(
      tasks.map((task) => ({
        number: task.number,
        title: task.title,
        status: task.status,
        columnId: task.columnId,
        position: task.position,
        priority: task.priority,
        userId: task.userId,
      })),
    ).toEqual([
      {
        number: 1,
        title: "Write the copy",
        status: "backlog",
        columnId: columnId("backlog"),
        position: 1,
        priority: "high",
        userId: member.id,
      },
      {
        number: 2,
        title: "Untitled task",
        status: "backlog",
        columnId: columnId("backlog"),
        position: 2,
        priority: "no-priority",
        userId: null,
      },
      {
        number: 3,
        title: "Someday",
        status: "planned",
        columnId: null,
        position: 1,
        priority: "low",
        userId: null,
      },
      {
        number: 4,
        title: "Old launch",
        status: "archived",
        columnId: null,
        position: 1,
        priority: "no-priority",
        userId: null,
      },
      {
        number: 5,
        title: "Ship it",
        status: "shipped",
        columnId: columnId("shipped"),
        position: 1,
        priority: "urgent",
        userId: null,
      },
    ]);
    const [first, , someday, , shipIt] = tasks;
    expect(first?.description).toBe("Draft **all** pages");
    expect(first?.createdAt.toISOString()).toBe("2023-05-06T07:08:09.000Z");
    expect(first?.dueDate?.toISOString()).toBe("2024-02-01T00:00:00.000Z");

    const definitions = await db
      .select({ name: schema.labelTable.name, color: schema.labelTable.color })
      .from(schema.labelTable)
      .where(
        and(
          eq(schema.labelTable.workspaceId, workspaceId),
          isNull(schema.labelTable.taskId),
        ),
      )
      .orderBy(asc(schema.labelTable.name));
    expect(definitions).toEqual([
      { name: "Bug", color: "#123456" },
      { name: "Design", color: "purple" },
    ]);
    const taskLabels = await db
      .select({
        taskId: schema.labelTable.taskId,
        name: schema.labelTable.name,
        color: schema.labelTable.color,
      })
      .from(schema.labelTable)
      .where(
        inArray(
          schema.labelTable.taskId,
          tasks.map((task) => task.id),
        ),
      )
      .orderBy(asc(schema.labelTable.name));
    expect(taskLabels).toEqual(
      expect.arrayContaining([
        { taskId: first?.id, name: "Bug", color: "#123456" },
        { taskId: first?.id, name: "Design", color: "purple" },
        { taskId: shipIt?.id, name: "Bug", color: "#123456" },
      ]),
    );
    expect(taskLabels).toHaveLength(3);

    const activities = await db
      .select()
      .from(schema.activityTable)
      .where(
        inArray(
          schema.activityTable.taskId,
          tasks.map((task) => task.id),
        ),
      );
    const created = activities.filter(
      (activity) => activity.type === "created",
    );
    expect(created).toHaveLength(5);
    expect(created.every((activity) => activity.userId === admin.user.id)).toBe(
      true,
    );
    expect(
      created.find((activity) => activity.taskId === first?.id)?.createdAt,
    ).toEqual(first?.createdAt);
    const comments = activities
      .filter((activity) => activity.type === "comment")
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    expect(
      comments.map((comment) => ({
        taskId: comment.taskId,
        userId: comment.userId,
        content: comment.content,
        externalUserName: comment.externalUserName,
        externalSource: comment.externalSource,
      })),
    ).toEqual([
      {
        taskId: first?.id,
        userId: admin.user.id,
        content: "Looks good",
        externalUserName: "Ana",
        externalSource: "planka",
      },
      {
        taskId: first?.id,
        userId: admin.user.id,
        content: "No author",
        externalUserName: "Unknown user",
        externalSource: "planka",
      },
    ]);
    expect(comments[0]?.createdAt.toISOString()).toBe(
      "2024-01-02T03:04:05.000Z",
    );

    const relations = await db
      .select({
        sourceTaskId: schema.taskRelationTable.sourceTaskId,
        targetTaskId: schema.taskRelationTable.targetTaskId,
        relationType: schema.taskRelationTable.relationType,
      })
      .from(schema.taskRelationTable)
      .where(
        inArray(
          schema.taskRelationTable.sourceTaskId,
          tasks.map((task) => task.id),
        ),
      );
    expect(relations).toEqual(
      expect.arrayContaining([
        {
          sourceTaskId: first?.id,
          targetTaskId: shipIt?.id,
          relationType: "subtask",
        },
        {
          sourceTaskId: first?.id,
          targetTaskId: someday?.id,
          relationType: "blocks",
        },
      ]),
    );
    expect(relations).toHaveLength(2);

    const notifications = await db.select().from(schema.notificationTable);
    expect(notifications).toEqual([]);

    const [storedRun] = await db
      .select()
      .from(schema.importRunTable)
      .where(eq(schema.importRunTable.id, run.id));
    expect(storedRun?.userId).toBe(admin.user.id);
    expect(JSON.stringify(storedRun)).not.toContain(SECRET);

    const listed = await get(`/runs/${workspaceId}`);
    expect(listed.status).toBe(200);
    const listedText = await listed.text();
    expect(listedText).not.toContain(SECRET);
    expect(JSON.parse(listedText).runs).toHaveLength(1);
  });

  it("leaves no project behind when saving its content fails", async () => {
    const admin = await createAdmin();
    const workspaceId = admin.workspace.id;
    importers.connectSource.mockResolvedValue(
      fakeSource(async () => plankaProject("")),
    );
    vi.mocked(writeImportRelations).mockRejectedValueOnce(
      new Error("relations failed"),
    );
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    mockAuthenticatedSession(admin.user);

    try {
      const started = await post("/runs", {
        workspaceId,
        connection,
        projectIds: ["p1"],
      });
      expect(started.status).toBe(202);
      const { run } = (await started.json()) as { run: { id: string } };
      await waitForActiveImports();

      const polled = await get(`/runs/${workspaceId}/${run.id}`);
      const { run: finished } = (await polled.json()) as {
        run: { projects: Record<string, unknown>[] };
      };
      expect(finished.projects).toEqual([
        expect.objectContaining({
          status: "failed",
          projectId: null,
          error: "Kaneo could not save this project.",
        }),
      ]);
      expect(writeImportRelations).toHaveBeenCalled();

      const projects = await db
        .select({ id: schema.projectTable.id })
        .from(schema.projectTable)
        .where(eq(schema.projectTable.workspaceId, workspaceId));
      expect(projects).toEqual([]);
    } finally {
      logged.mockRestore();
    }
  });

  it("keeps the source key and task numbers", async () => {
    const admin = await createAdmin();
    const workspaceId = admin.workspace.id;
    importers.connectSource.mockResolvedValue(
      fakeSource(async () => numberedProject()),
    );
    mockAuthenticatedSession(admin.user);

    const imported = await importProject(workspaceId);
    expect(imported.projectSlug).toBe("ENG");

    const [project] = await db
      .select()
      .from(schema.projectTable)
      .where(eq(schema.projectTable.id, imported.projectId));
    expect(project).toMatchObject({ slug: "ENG", lastTaskNumber: 9 });

    const tasks = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.projectId, imported.projectId))
      .orderBy(asc(schema.taskTable.number));
    expect(
      tasks.map(({ number, title, status, position }) => ({
        number,
        title,
        status,
        position,
      })),
    ).toEqual([
      { number: 3, title: "Three", status: "to-do", position: 3 },
      { number: 7, title: "Seven", status: "to-do", position: 1 },
      { number: 8, title: "No number", status: "to-do", position: 2 },
      { number: 9, title: "Another seven", status: "to-do", position: 4 },
    ]);

    const created = await createApp().app.request(
      `/api/task/${imported.projectId}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Made after the import",
          description: "",
          priority: "low",
          status: "to-do",
        }),
      },
    );
    expect(created.status).toBe(200);
    expect(((await created.json()) as { number: number }).number).toBe(10);
  });

  it("keeps assignments to an importer limited to selected projects", async () => {
    const admin = await createAdmin();
    const workspaceId = admin.workspace.id;
    await db.insert(schema.workspaceMemberAccessTable).values({
      workspaceId,
      userId: admin.user.id,
      projectAccess: "selected",
    });
    const project = numberedProject();
    const [first] = project.tasks;
    if (first) first.assignee = { email: admin.user.email };
    importers.connectSource.mockResolvedValue(fakeSource(async () => project));
    mockAuthenticatedSession(admin.user);

    const imported = await importProject(workspaceId);

    const grants = await db
      .select()
      .from(schema.workspaceMemberProjectTable)
      .where(
        and(
          eq(schema.workspaceMemberProjectTable.userId, admin.user.id),
          eq(schema.workspaceMemberProjectTable.projectId, imported.projectId),
        ),
      );
    expect(grants).toHaveLength(1);

    const [assigned] = await db
      .select({ userId: schema.taskTable.userId })
      .from(schema.taskTable)
      .where(
        and(
          eq(schema.taskTable.projectId, imported.projectId),
          eq(schema.taskTable.number, 7),
        ),
      );
    expect(assigned?.userId).toBe(admin.user.id);
  });

  it("suffixes the source key when the workspace already uses it", async () => {
    const admin = await createAdmin();
    const workspaceId = admin.workspace.id;
    await createProjectFixture({ workspaceId, name: "Existing", slug: "ENG" });
    importers.connectSource.mockResolvedValue(
      fakeSource(async () => numberedProject()),
    );
    mockAuthenticatedSession(admin.user);

    const imported = await importProject(workspaceId);

    expect(imported.projectSlug).toBe("ENG-2");
    const [project] = await db
      .select({ slug: schema.projectTable.slug })
      .from(schema.projectTable)
      .where(eq(schema.projectTable.id, imported.projectId));
    expect(project?.slug).toBe("ENG-2");
  });

  it("refuses members and viewers", async () => {
    const admin = await createAdmin();
    const workspaceId = admin.workspace.id;
    const member = await addMember(workspaceId, "Member");
    const viewer = await addMember(workspaceId, "Viewer", "viewer");

    for (const user of [member, viewer]) {
      mockAuthenticatedSession(user);
      const listed = await post("/projects", { workspaceId, connection });
      expect(listed.status).toBe(403);
      const started = await post("/runs", {
        workspaceId,
        connection,
        projectIds: ["p1"],
      });
      expect(started.status).toBe(403);
      expect((await get(`/runs/${workspaceId}`)).status).toBe(403);
      expect((await get(`/trello/authorize-url/${workspaceId}`)).status).toBe(
        403,
      );
      vi.restoreAllMocks();
    }

    expect(importers.connectSource).not.toHaveBeenCalled();
  });

  it("links admins to Trello's authorize page only when the server has a key", async () => {
    const admin = await createAdmin();
    const workspaceId = admin.workspace.id;
    mockAuthenticatedSession(admin.user);

    vi.stubEnv("TRELLO_API_KEY", "");
    const unset = await get(`/trello/authorize-url/${workspaceId}`);
    expect(unset.status).toBe(200);
    expect(await unset.json()).toEqual({ authorizeUrl: null });

    vi.stubEnv("TRELLO_API_KEY", " trello-app-key ");
    const set = await get(`/trello/authorize-url/${workspaceId}`);
    expect(set.status).toBe(200);
    const body = (await set.json()) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(["authorizeUrl"]);
    const url = new URL(String(body.authorizeUrl));
    expect(url.origin + url.pathname).toBe("https://trello.com/1/authorize");
    expect(url.searchParams.get("key")).toBe("trello-app-key");
    expect(url.searchParams.get("scope")).toBe("read");

    const config = await createApp().app.request("/api/config");
    expect(await config.text()).not.toContain("trello-app-key");
    vi.unstubAllEnvs();
  });

  it("allows one running import per workspace", async () => {
    const admin = await createAdmin();
    const workspaceId = admin.workspace.id;
    await db.insert(schema.importRunTable).values({
      workspaceId,
      userId: admin.user.id,
      source: "linear",
      projects: [],
    });
    importers.connectSource.mockResolvedValue(
      fakeSource(async () => plankaProject("")),
    );
    mockAuthenticatedSession(admin.user);

    const response = await post("/runs", {
      workspaceId,
      connection,
      projectIds: ["p1"],
    });

    expect(response.status).toBe(409);
    expect(importers.connectSource).not.toHaveBeenCalled();
  });

  it("reports and settles a run whose server stopped answering", async () => {
    const admin = await createAdmin();
    const workspaceId = admin.workspace.id;
    const [stale] = await db
      .insert(schema.importRunTable)
      .values({
        workspaceId,
        userId: admin.user.id,
        source: "trello",
        projects: [
          {
            sourceId: "b1",
            name: "Board",
            status: "running",
            projectId: null,
            projectSlug: null,
            counts: {
              columns: 0,
              tasks: 0,
              labels: 0,
              comments: 0,
              assignees: 0,
              relations: 0,
            },
            warnings: [],
            error: null,
          },
        ],
        heartbeatAt: new Date(Date.now() - 5 * 60_000),
      })
      .returning();
    mockAuthenticatedSession(admin.user);

    const response = await get(`/runs/${workspaceId}`);

    expect(response.status).toBe(200);
    const { runs } = (await response.json()) as {
      runs: { status: string; error: string; projects: { status: string }[] }[];
    };
    expect(runs[0]).toMatchObject({
      status: "failed",
      error: "The import was interrupted before it finished.",
      projects: [{ status: "failed" }],
    });
    const [stored] = await db
      .select()
      .from(schema.importRunTable)
      .where(eq(schema.importRunTable.id, stale?.id ?? ""));
    expect(stored?.status).toBe("failed");
    expect(stored?.finishedAt).not.toBeNull();
  });

  it("limits how many imports one server runs at once", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    importers.connectSource.mockImplementation(async () =>
      fakeSource(async () => {
        await gate;
        return { ...plankaProject(""), tasks: [], relations: [] };
      }),
    );

    try {
      for (let index = 0; index < 2; index++) {
        const admin = await createAdmin();
        mockAuthenticatedSession(admin.user);
        const response = await post("/runs", {
          workspaceId: admin.workspace.id,
          connection,
          projectIds: ["p1"],
        });
        expect(response.status).toBe(202);
        vi.restoreAllMocks();
      }

      const third = await createAdmin();
      mockAuthenticatedSession(third.user);
      const response = await post("/runs", {
        workspaceId: third.workspace.id,
        connection,
        projectIds: ["p1"],
      });
      expect(response.status).toBe(429);
    } finally {
      release();
      await waitForActiveImports();
    }
  });

  it("rejects projects the source does not list and runs from other workspaces", async () => {
    const admin = await createAdmin();
    const other = await createAdmin();
    const [foreign] = await db
      .insert(schema.importRunTable)
      .values({
        workspaceId: other.workspace.id,
        source: "planka",
        projects: [],
        status: "completed",
      })
      .returning();
    importers.connectSource.mockResolvedValue(
      fakeSource(async () => plankaProject("")),
    );
    mockAuthenticatedSession(admin.user);

    const missing = await post("/runs", {
      workspaceId: admin.workspace.id,
      connection,
      projectIds: ["p9"],
    });
    expect(missing.status).toBe(400);
    expect((await readErrorBody(missing)).message).toBe(
      "A selected project is no longer available in PLANKA. Refresh the list and try again.",
    );

    const duplicate = await post("/runs", {
      workspaceId: admin.workspace.id,
      connection,
      projectIds: ["p1", "p1"],
    });
    expect(duplicate.status).toBe(400);

    const notHere = await get(`/runs/${admin.workspace.id}/${foreign?.id}`);
    expect(notHere.status).toBe(404);
  });
});

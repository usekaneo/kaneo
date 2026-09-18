import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { addWorkspaceMember, requestAs } from "./helpers/company";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

type User = typeof schema.userTable.$inferSelect;

// Page titles come from a real fetch; tests stay offline and pick the answer.
const preview = vi.hoisted(() => ({ title: null as string | null }));
vi.mock("../../apps/api/src/link-preview/fetch-preview", async (original) => ({
  ...(await original<object>()),
  getLinkPreview: async (url: string) =>
    preview.title
      ? {
          url,
          title: preview.title,
          description: null,
          image: null,
          siteName: null,
          favicon: null,
          youtubeId: null,
        }
      : null,
}));

beforeEach(async () => {
  await resetTestDatabase();
  preview.title = null;
});

async function uploadFile(user: User, workspaceId: string, name: string) {
  mockAuthenticatedSession(user);
  const { app } = createApp();
  const query = new URLSearchParams({ workspaceId, name, folder: "Tasks/T-1" });
  const response = await app.request(`/api/files/upload?${query}`, {
    method: "PUT",
    headers: { "Content-Type": "image/png" },
    body: "fake-png",
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { id: string }).id;
}

async function seedTask(workspaceId: string, assigneeId: string) {
  const { project, columns } = await createProjectFixture({ workspaceId });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      userId: assigneeId,
      title: "Design review",
      status: "to-do",
      columnId: columns.todo.id,
      number: 1,
    })
    .returning();
  return task;
}

describe("task attachments", () => {
  it("attaches files and links, lists them, and removes a file from the library", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "member" });
    const task = await seedTask(workspace.id, user.id);
    const as = requestAs(user);

    const fileId = await uploadFile(user, workspace.id, "mock.png");
    const file = await as(`/task-attachment/${task.id}/file`, {
      method: "POST",
      body: { fileId },
    });
    expect(file.status).toBe(200);
    expect(file.json).toMatchObject({
      kind: "file",
      title: "mock.png",
      mimeType: "image/png",
      fileId,
    });

    const link = await as(`/task-attachment/${task.id}/link`, {
      method: "POST",
      body: { url: "https://www.figma.com/file/abc" },
    });
    expect(link.status).toBe(200);
    expect(link.json).toMatchObject({ kind: "link", title: "www.figma.com" });

    const bad = await as(`/task-attachment/${task.id}/link`, {
      method: "POST",
      body: { url: "javascript:alert(1)" },
    });
    expect(bad.status).toBe(400);

    const list = await as(`/task-attachment/${task.id}`);
    expect(list.json).toHaveLength(2);

    // The person's task list reports the count.
    const tasks = await as(
      `/people/${user.id}/tasks?workspaceId=${workspace.id}`,
    );
    expect(tasks.json[0].attachmentCount).toBe(2);

    const removed = await as(`/task-attachment/${task.id}/${file.json.id}`, {
      method: "DELETE",
    });
    expect(removed.status).toBe(200);
    const stored = await db
      .select()
      .from(schema.storedFileTable)
      .where(eq(schema.storedFileTable.id, fileId));
    expect(stored).toHaveLength(0);
    expect((await as(`/task-attachment/${task.id}`)).json).toHaveLength(1);
  });

  it("names a link after its page unless a title is typed", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "member" });
    const task = await seedTask(workspace.id, user.id);
    const as = requestAs(user);

    // Without a title, the page's own title wins over the host name…
    preview.title = "Launch plan – Figma";
    const titled = await as(`/task-attachment/${task.id}/link`, {
      method: "POST",
      body: { url: "https://www.figma.com/file/def" },
    });
    expect(titled.json.title).toBe("Launch plan – Figma");
    // …and a title typed by hand wins over both.
    const named = await as(`/task-attachment/${task.id}/link`, {
      method: "POST",
      body: { url: "https://www.figma.com/file/ghi", title: "Mockups" },
    });
    expect(named.json.title).toBe("Mockups");
  });

  it("refuses files from another workspace and someone else's file removal", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "member" });
    const other = await createWorkspaceMember({ role: "member" });
    const bob = await addWorkspaceMember(workspace.id, "member", "Bob");
    const task = await seedTask(workspace.id, user.id);

    const foreignFile = await uploadFile(
      other.user,
      other.workspace.id,
      "x.png",
    );
    const foreign = await requestAs(user)(`/task-attachment/${task.id}/file`, {
      method: "POST",
      body: { fileId: foreignFile },
    });
    expect(foreign.status).toBe(400);

    const mine = await uploadFile(user, workspace.id, "mine.png");
    const attached = await requestAs(user)(`/task-attachment/${task.id}/file`, {
      method: "POST",
      body: { fileId: mine },
    });
    const byBob = await requestAs(bob)(
      `/task-attachment/${task.id}/${attached.json.id}`,
      { method: "DELETE" },
    );
    expect(byBob.status).toBe(403);

    const outsider = await requestAs(other.user)(`/task-attachment/${task.id}`);
    expect(outsider.status).toBe(403);
  });

  it("saves a person's own task order and only theirs", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "member" });
    const bob = await addWorkspaceMember(workspace.id, "member", "Bob");
    const first = await seedTask(workspace.id, user.id);
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const [second] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        userId: user.id,
        title: "Second",
        status: "to-do",
        number: 1,
      })
      .returning();

    const saved = await requestAs(user)(`/people/${user.id}/tasks/order`, {
      method: "PUT",
      body: {
        workspaceId: workspace.id,
        taskIds: [second.id, "not-a-task", first.id],
      },
    });
    expect(saved.status).toBe(200);
    expect(saved.json.taskIds).toEqual([second.id, first.id]);

    const tasks = await requestAs(user)(
      `/people/${user.id}/tasks?workspaceId=${workspace.id}`,
    );
    const position = Object.fromEntries(
      tasks.json.map((t: { id: string; myPosition: number | null }) => [
        t.id,
        t.myPosition,
      ]),
    );
    expect(position).toEqual({ [second.id]: 0, [first.id]: 1 });

    const forged = await requestAs(bob)(`/people/${user.id}/tasks/order`, {
      method: "PUT",
      body: { workspaceId: workspace.id, taskIds: [first.id] },
    });
    expect(forged.status).toBe(403);
  });

  it("reports who assigned a task", async () => {
    const { user: owner, workspace } = await createWorkspaceMember({
      role: "owner",
      userName: "Olivia",
    });
    const alice = await addWorkspaceMember(workspace.id, "member", "Alice");
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });

    const created = await requestAs(owner)(`/task/${project.id}`, {
      method: "POST",
      body: {
        title: "Prepare slides",
        description: "",
        priority: "urgent",
        status: "to-do",
        userId: alice.id,
      },
    });
    expect(created.status).toBe(200);

    const tasks = await requestAs(alice)(
      `/people/${alice.id}/tasks?workspaceId=${workspace.id}`,
    );
    expect(tasks.json[0]).toMatchObject({
      title: "Prepare slides",
      priority: "urgent",
      statusName: "To Do",
      assignedById: owner.id,
      assignedByName: "Olivia",
    });
  });
});

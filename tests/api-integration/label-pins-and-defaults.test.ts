import { asc, eq } from "drizzle-orm";
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

type User = { id: string; email: string; name: string };

async function workspaceLabel(workspaceId: string, name: string) {
  const [label] = await db
    .insert(schema.labelTable)
    .values({ name, color: "purple", workspaceId })
    .returning();
  return label;
}

function client(user: User) {
  mockAuthenticatedSession(user);
  const { app } = createApp();
  return (method: string, path: string, body?: unknown) =>
    app.request(`/api${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
}

async function taskLabels(taskId: string) {
  const rows = await db
    .select({ name: schema.labelTable.name })
    .from(schema.labelTable)
    .where(eq(schema.labelTable.taskId, taskId))
    .orderBy(asc(schema.labelTable.name));
  return rows.map((row) => row.name);
}

const newTask = {
  title: "Walk cycle",
  description: "",
  priority: "low",
  status: "to-do",
};

describe("API integration: project default labels", () => {
  beforeEach(resetTestDatabase);

  it("starts every new task with the project's default labels", async () => {
    const me = await createWorkspaceMember({ role: "admin" });
    const web = await createProjectFixture({ workspaceId: me.workspace.id });
    const animation = await workspaceLabel(me.workspace.id, "animacja");
    const retro = await workspaceLabel(me.workspace.id, "pc-oldschool");
    const api = client(me.user);

    const set = await api("PUT", `/label/project/${web.project.id}/defaults`, {
      labelIds: [retro.id, animation.id, animation.id],
    });
    expect(set.status).toBe(200);
    expect(
      ((await set.json()) as { name: string }[]).map((label) => label.name),
    ).toEqual(["animacja", "pc-oldschool"]);

    const created = await api("POST", `/task/${web.project.id}`, newTask);
    expect(created.status).toBe(200);
    const task = (await created.json()) as { id: string };
    expect(await taskLabels(task.id)).toEqual(["animacja", "pc-oldschool"]);

    const byWorkspace = await api(
      "GET",
      `/label/workspace/${me.workspace.id}/project-defaults`,
    );
    expect(
      ((await byWorkspace.json()) as { projectId: string; name: string }[]).map(
        (row) => [row.projectId, row.name],
      ),
    ).toEqual([
      [web.project.id, "animacja"],
      [web.project.id, "pc-oldschool"],
    ]);

    // A client that picked labels itself opts out.
    const picked = await api("POST", `/task/${web.project.id}`, {
      ...newTask,
      defaultLabels: false,
    });
    expect(
      await taskLabels(((await picked.json()) as { id: string }).id),
    ).toEqual([]);

    // Clearing the set stops it.
    await api("PUT", `/label/project/${web.project.id}/defaults`, {
      labelIds: [],
    });
    const plain = await api("POST", `/task/${web.project.id}`, newTask);
    expect(
      await taskLabels(((await plain.json()) as { id: string }).id),
    ).toEqual([]);
  });

  it("only accepts workspace labels of the project, from people who may edit it", async () => {
    const me = await createWorkspaceMember({ role: "admin" });
    const web = await createProjectFixture({ workspaceId: me.workspace.id });
    const other = await createWorkspaceMember();
    const foreign = await workspaceLabel(other.workspace.id, "foreign");
    const mine = await workspaceLabel(me.workspace.id, "mine");
    const api = client(me.user);

    expect(
      (
        await api("PUT", `/label/project/${web.project.id}/defaults`, {
          labelIds: [foreign.id],
        })
      ).status,
    ).toBe(400);

    const member = await addWorkspaceMember(me.workspace.id, "member");
    const memberApi = client(member);
    expect(
      (
        await memberApi("PUT", `/label/project/${web.project.id}/defaults`, {
          labelIds: [mine.id],
        })
      ).status,
    ).toBe(403);
    expect(
      (await memberApi("GET", `/label/project/${web.project.id}/defaults`))
        .status,
    ).toBe(200);
  });
});

describe("API integration: pinned labels", () => {
  beforeEach(resetTestDatabase);

  it("keeps personal pins and drops them when the label goes", async () => {
    const me = await createWorkspaceMember();
    const animation = await workspaceLabel(me.workspace.id, "animacja");
    const retro = await workspaceLabel(me.workspace.id, "pc-oldschool");
    const api = client(me.user);

    expect((await api("PUT", `/label/${retro.id}/pin`)).status).toBe(200);
    expect((await api("PUT", `/label/${animation.id}/pin`)).status).toBe(200);
    expect((await api("PUT", `/label/${animation.id}/pin`)).status).toBe(200);
    const pinned = async () =>
      (
        (await (await api("GET", "/label/pinned")).json()) as { name: string }[]
      ).map((label) => label.name);
    expect(await pinned()).toEqual(["pc-oldschool", "animacja"]);

    const teammate = await addWorkspaceMember(me.workspace.id);
    const theirs = client(teammate);
    expect(await (await theirs("GET", "/label/pinned")).json()).toEqual([]);

    expect(
      (await client(me.user)("DELETE", `/label/${retro.id}/pin`)).status,
    ).toBe(200);
    await db
      .delete(schema.labelTable)
      .where(eq(schema.labelTable.id, animation.id));
    expect(await pinned()).toEqual([]);
  });

  it("refuses task label copies and labels from other workspaces", async () => {
    const me = await createWorkspaceMember();
    const web = await createProjectFixture({ workspaceId: me.workspace.id });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: web.project.id,
        title: "T",
        status: "to-do",
        number: 1,
      })
      .returning();
    const [copy] = await db
      .insert(schema.labelTable)
      .values({
        name: "bug",
        color: "red",
        taskId: task.id,
        workspaceId: me.workspace.id,
      })
      .returning();
    const stranger = await createWorkspaceMember();
    const foreign = await workspaceLabel(stranger.workspace.id, "secret");
    const api = client(me.user);

    expect((await api("PUT", `/label/${copy.id}/pin`)).status).toBe(400);
    expect([403, 404]).toContain(
      (await api("PUT", `/label/${foreign.id}/pin`)).status,
    );
    expect(await (await api("GET", "/label/pinned")).json()).toEqual([]);
  });
});

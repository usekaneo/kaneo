import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

type User = typeof schema.userTable.$inferSelect;

async function seedTask(workspaceId: string, title = "Tracked task") {
  const { project, columns } = await createProjectFixture({ workspaceId });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title,
      description: "",
      priority: "low",
      status: "to-do",
      columnId: columns.todo?.id ?? null,
      number: 1,
      position: 1,
    })
    .returning();
  return { task, project };
}

async function addMember(workspaceId: string, role: string) {
  const id = `user-${randomUUID()}`;
  const [user] = await db
    .insert(schema.userTable)
    .values({
      id,
      email: `${id}@example.com`,
      emailVerified: true,
      name: `${role} user`,
    })
    .returning();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: user.id,
    role,
    joinedAt: new Date(),
  });
  return user;
}

async function logEntry(
  userId: string,
  taskId: string,
  start: string,
  end: string | null,
) {
  const startTime = new Date(start);
  const endTime = end ? new Date(end) : null;
  const [entry] = await db
    .insert(schema.timeEntryTable)
    .values({
      taskId,
      userId,
      description: "",
      startTime,
      endTime,
      duration: endTime
        ? Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
        : null,
    })
    .returning();
  return entry;
}

function as(user: User) {
  mockAuthenticatedSession(user);
  const { app } = createApp();
  return (path: string, init?: RequestInit) =>
    app.request(`/api${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
}

beforeEach(async () => {
  await resetTestDatabase();
});

describe("time tracking: one running timer per person", () => {
  it("stops the running timer when a new one starts", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "member" });
    const { task: first } = await seedTask(workspace.id, "First");
    const { task: second } = await seedTask(workspace.id, "Second");
    const request = as(user);

    const start = (taskId: string) =>
      request("/time-entry", {
        method: "POST",
        body: JSON.stringify({ taskId, startTime: new Date().toISOString() }),
      });

    const firstEntry = await (await start(first.id)).json();
    const secondResponse = await start(second.id);
    expect(secondResponse.status).toBe(200);

    const [closed] = await db
      .select()
      .from(schema.timeEntryTable)
      .where(eq(schema.timeEntryTable.id, firstEntry.id));
    expect(closed.endTime).not.toBeNull();
    expect(closed.duration).not.toBeNull();

    const running = await (
      await request(`/time-entry/running?workspaceId=${workspace.id}`)
    ).json();
    expect(running.taskTitle).toBe("Second");
  });

  it("does not stop the running timer when a finished entry is logged", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "member" });
    const { task } = await seedTask(workspace.id);
    const running = await logEntry(
      user.id,
      task.id,
      "2026-01-01T09:00:00.000Z",
      null,
    );
    const request = as(user);

    await request("/time-entry", {
      method: "POST",
      body: JSON.stringify({
        taskId: task.id,
        startTime: "2025-12-31T09:00:00.000Z",
        endTime: "2025-12-31T10:00:00.000Z",
      }),
    });

    const [stillRunning] = await db
      .select()
      .from(schema.timeEntryTable)
      .where(eq(schema.timeEntryTable.id, running.id));
    expect(stillRunning.endTime).toBeNull();
  });

  it("stops a running entry and treats a second stop as a no-op", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "member" });
    const { task } = await seedTask(workspace.id);
    const entry = await logEntry(
      user.id,
      task.id,
      "2026-01-01T09:00:00.000Z",
      null,
    );
    const request = as(user);

    const stopped = await (
      await request(`/time-entry/${entry.id}/stop`, { method: "POST" })
    ).json();
    const again = await (
      await request(`/time-entry/${entry.id}/stop`, { method: "POST" })
    ).json();

    expect(stopped.endTime).not.toBeNull();
    expect(again.endTime).toBe(stopped.endTime);
    const running = await (
      await request(`/time-entry/running?workspaceId=${workspace.id}`)
    ).json();
    expect(running).toBeNull();
  });
});

describe("time tracking: who can change and see whose time", () => {
  it("keeps members away from other people's entries but lets admins fix them", async () => {
    const { workspace } = await createWorkspaceMember({ role: "owner" });
    const alice = await addMember(workspace.id, "member");
    const bob = await addMember(workspace.id, "member");
    const admin = await addMember(workspace.id, "admin");
    const { task } = await seedTask(workspace.id);
    const aliceEntry = await logEntry(
      alice.id,
      task.id,
      "2026-01-01T09:00:00.000Z",
      "2026-01-01T10:00:00.000Z",
    );
    const update = JSON.stringify({
      startTime: "2026-01-01T09:00:00.000Z",
      endTime: "2026-01-01T11:00:00.000Z",
    });

    const asBob = as(bob);
    expect(
      (
        await asBob(`/time-entry/${aliceEntry.id}`, {
          method: "PUT",
          body: update,
        })
      ).status,
    ).toBe(403);
    expect(
      (await asBob(`/time-entry/${aliceEntry.id}`, { method: "DELETE" }))
        .status,
    ).toBe(403);

    const asAlice = as(alice);
    expect(
      (
        await asAlice(`/time-entry/${aliceEntry.id}`, {
          method: "PUT",
          body: update,
        })
      ).status,
    ).toBe(200);

    const asAdmin = as(admin);
    expect(
      (await asAdmin(`/time-entry/${aliceEntry.id}`, { method: "DELETE" }))
        .status,
    ).toBe(200);
  });

  it("limits the timesheet to your own time unless you may see everyone's", async () => {
    const { user: owner, workspace } = await createWorkspaceMember({
      role: "owner",
    });
    const alice = await addMember(workspace.id, "member");
    const { task } = await seedTask(workspace.id);
    await logEntry(
      alice.id,
      task.id,
      "2026-01-05T09:00:00.000Z",
      "2026-01-05T10:00:00.000Z",
    );
    await logEntry(
      owner.id,
      task.id,
      "2026-01-06T09:00:00.000Z",
      "2026-01-06T12:00:00.000Z",
    );
    const range = `workspaceId=${workspace.id}&from=2026-01-05T00:00:00Z&to=2026-01-12T00:00:00Z`;

    const asAlice = as(alice);
    const own = await (await asAlice(`/time-entry?${range}`)).json();
    expect(own.map((e: { userId: string }) => e.userId)).toEqual([alice.id]);
    expect(
      (await asAlice(`/time-entry?${range}&userId=${owner.id}`)).status,
    ).toBe(403);

    const asOwner = as(owner);
    const everyone = await (await asOwner(`/time-entry?${range}`)).json();
    expect(everyone).toHaveLength(2);
    expect(everyone[0]).toMatchObject({
      taskTitle: "Tracked task",
      projectName: "Integration Project",
    });
  });

  it("rejects ranges that are backwards or longer than a quarter", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const request = as(user);

    expect(
      (
        await request(
          `/time-entry?workspaceId=${workspace.id}&from=2026-02-01T00:00:00Z&to=2026-01-01T00:00:00Z`,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          `/time-entry?workspaceId=${workspace.id}&from=2026-01-01T00:00:00Z&to=2026-06-01T00:00:00Z`,
        )
      ).status,
    ).toBe(400);
  });
});

describe("admin time entry permission migration", () => {
  async function runMigration() {
    const file = new URL(
      "../../apps/api/drizzle/0047_grant_admin_time_entry_permissions.sql",
      import.meta.url,
    );
    await db.execute(sql.raw(readFileSync(file, "utf8")));
  }

  it("grants existing admin roles the new permission once, leaving others alone", async () => {
    const { workspace } = await createWorkspaceMember({ role: "owner" });
    await db.insert(schema.workspaceRoleTable).values([
      {
        workspaceId: workspace.id,
        role: "admin",
        permission: JSON.stringify({ task: ["read"] }),
      },
      {
        workspaceId: workspace.id,
        role: "member",
        permission: JSON.stringify({ task: ["read"] }),
      },
    ]);

    await runMigration();
    await runMigration();

    const rows = await db
      .select()
      .from(schema.workspaceRoleTable)
      .where(eq(schema.workspaceRoleTable.workspaceId, workspace.id));
    const byRole = Object.fromEntries(
      rows.map((r) => [r.role, JSON.parse(r.permission)]),
    );

    expect(byRole.admin).toEqual({
      task: ["read"],
      timeEntry: ["read_all", "manage_all"],
    });
    expect(byRole.member).toEqual({ task: ["read"] });
  });
});

describe("time tracking: viewers", () => {
  it("can't stop or delete even their own old entries", async () => {
    const { workspace } = await createWorkspaceMember({ role: "owner" });
    const viewer = await addMember(workspace.id, "viewer");
    const { task } = await seedTask(workspace.id);
    const entry = await logEntry(
      viewer.id,
      task.id,
      "2026-09-14T04:00:00Z",
      null,
    );
    expect(
      (await as(viewer)(`/time-entry/${entry.id}/stop`, { method: "POST" }))
        .status,
    ).toBe(403);
    expect(
      (await as(viewer)(`/time-entry/${entry.id}`, { method: "DELETE" }))
        .status,
    ).toBe(403);
  });
});

describe("time tracking: stopping with a note", () => {
  it("saves what was done, and still stops without one", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { task } = await seedTask(workspace.id);
    const first = await logEntry(
      user.id,
      task.id,
      "2026-09-14T04:00:00Z",
      null,
    );
    const stopped = await as(user)(`/time-entry/${first.id}/stop`, {
      method: "POST",
      body: JSON.stringify({ description: "  Compressed hero images  " }),
    });
    expect(stopped.status).toBe(200);
    expect(await stopped.json()).toMatchObject({
      description: "Compressed hero images",
    });

    const second = await logEntry(
      user.id,
      task.id,
      "2026-09-15T04:00:00Z",
      null,
    );
    const plain = await as(user)(`/time-entry/${second.id}/stop`, {
      method: "POST",
    });
    expect(plain.status).toBe(200);
    expect((await plain.json()).endTime).not.toBeNull();
  });
});

import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import db, { getDatabasePool, schema } from "../../apps/api/src/database";
import { subscribeToEvent } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import deleteLabel, {
  LABEL_DELETE_BATCH_SIZE,
} from "../../apps/api/src/label/controllers/delete-label";
import {
  MAX_LABEL_DELETIONS_IN_FLIGHT,
  withLabelDeletionLock,
} from "../../apps/api/src/label/deletion-lock";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const { github, gitea, gitlab } = vi.hoisted(() => ({
  github: vi.fn(async (_id: string, _name: string) => {}),
  gitea: vi.fn(async (_id: string, _name: string) => {}),
  gitlab: vi.fn(async (_id: string, _name: string) => {}),
}));
vi.mock("../../apps/api/src/plugins/github/utils/sync-label-to-github", () => ({
  removeLabelFromGitHub: github,
  syncLabelToGitHub: vi.fn(),
}));
vi.mock("../../apps/api/src/plugins/gitea/utils/sync-label-to-gitea", () => ({
  removeLabelFromGitea: gitea,
  syncLabelToGitea: vi.fn(),
}));

vi.mock("../../apps/api/src/plugins/gitlab/utils/sync-label-to-gitlab", () => ({
  removeLabelFromGitlab: gitlab,
  syncLabelToGitlab: vi.fn(),
}));

let eventGate: Promise<void> | undefined;
let eventCalls: string[] = [];
await subscribeToEvent<{ taskId: string }>(
  "task.label_deleted",
  async (data) => {
    eventCalls.push(data.taskId);
    await eventGate;
  },
);
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
beforeEach(async () => {
  await resetTestDatabase();
  github.mockReset().mockResolvedValue();
  gitea.mockReset().mockResolvedValue();
  gitlab.mockReset().mockResolvedValue();
  eventGate = undefined;
  eventCalls = [];
});
async function fixture(count: number) {
  const member = await createWorkspaceMember({ role: "admin" });
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [root] = await db
    .insert(schema.labelTable)
    .values({ workspaceId: member.workspace.id, name: "bug", color: "red" })
    .returning();
  const tasks = count
    ? await db
        .insert(schema.taskTable)
        .values(
          Array.from({ length: count }, (_, i) => ({
            projectId: project.id,
            title: `Task ${i}`,
            status: "to-do",
            number: i + 1,
          })),
        )
        .returning()
    : [];
  if (tasks.length)
    await db.insert(schema.labelTable).values(
      tasks.map((task) => ({
        workspaceId: member.workspace.id,
        taskId: task.id,
        name: "bug",
        color: "red",
      })),
    );
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  return { member, project, root, tasks, app };
}
async function labelsFor(workspaceId: string) {
  return db
    .select()
    .from(schema.labelTable)
    .where(eq(schema.labelTable.workspaceId, workspaceId));
}

describe("bounded, resumable label deletion", () => {
  it("finishes all copies through bounded HTTP steps and keeps the root until completion", async () => {
    const { app, member, root } = await fixture(
      LABEL_DELETE_BATCH_SIZE * 2 + 3,
    );
    const first = await app.request(`/api/label/${root.id}`, {
      method: "DELETE",
    });
    expect(first.status).toBe(202);
    expect(await first.json()).toMatchObject({
      id: root.id,
      pendingDeletion: true,
    });
    expect(github).toHaveBeenCalledTimes(LABEL_DELETE_BATCH_SIZE);
    expect(gitea).toHaveBeenCalledTimes(LABEL_DELETE_BATCH_SIZE);
    expect(gitlab).toHaveBeenCalledTimes(LABEL_DELETE_BATCH_SIZE);
    expect(eventCalls).toHaveLength(LABEL_DELETE_BATCH_SIZE);
    const remaining = await labelsFor(member.workspace.id);
    expect(remaining).toHaveLength(LABEL_DELETE_BATCH_SIZE + 4);
    const marker = remaining.find(
      (label) => label.id === root.id,
    )?.deletionStartedAt;
    expect(marker).toBeInstanceOf(Date);
    // A fresh app/request resumes persisted state, without an in-memory cursor.
    const second = await createApp().app.request(`/api/label/${root.id}`, {
      method: "DELETE",
    });
    expect(second.status).toBe(202);
    expect(
      (await labelsFor(member.workspace.id)).find(
        (label) => label.id === root.id,
      )?.deletionStartedAt,
    ).toEqual(marker);
    expect(
      (await app.request(`/api/label/${root.id}`, { method: "DELETE" })).status,
    ).toBe(200);
    expect(await labelsFor(member.workspace.id)).toEqual([]);
    expect(github).toHaveBeenCalledTimes(LABEL_DELETE_BATCH_SIZE * 2 + 3);
    expect(new Set(eventCalls).size).toBe(eventCalls.length);
  });
  it("does not start the next provider operation until the current one resolves", async () => {
    const { member, root } = await fixture(3);
    const gate = deferred();
    github.mockImplementationOnce(async () => gate.promise);
    const pending = deleteLabel(root.id, member.user.id);
    try {
      await vi.waitFor(() => expect(github).toHaveBeenCalledTimes(1));
      expect(gitea).not.toHaveBeenCalled();
      expect(gitlab).not.toHaveBeenCalled();
      expect(eventCalls).toHaveLength(0);
      await expect(deleteLabel(root.id, member.user.id)).rejects.toMatchObject({
        status: 429,
      });
    } finally {
      gate.resolve();
    }
    await pending;
    expect(github).toHaveBeenCalledTimes(3);
    expect(gitea).toHaveBeenCalledTimes(3);
    expect(gitlab).toHaveBeenCalledTimes(3);
  });
  it("awaits real asynchronous event subscribers before deleting another copy", async () => {
    const { member, root } = await fixture(3);
    const gate = deferred();
    eventGate = gate.promise;
    const pending = deleteLabel(root.id, member.user.id);
    try {
      await vi.waitFor(() => expect(eventCalls).toHaveLength(1));
      expect(github).toHaveBeenCalledTimes(1);
      expect(await labelsFor(member.workspace.id)).toHaveLength(3); // root plus two copies
    } finally {
      gate.resolve();
    }
    await pending;
    expect(eventCalls).toHaveLength(3);
  });
  it("preserves task labels created after the persisted deletion boundary", async () => {
    const { member, root, tasks } = await fixture(LABEL_DELETE_BATCH_SIZE + 1);
    expect((await deleteLabel(root.id, member.user.id)).pendingDeletion).toBe(
      true,
    );
    const deletedTask = github.mock.calls[0][0];
    const [newLabel] = await db
      .insert(schema.labelTable)
      .values({
        workspaceId: member.workspace.id,
        taskId: deletedTask,
        name: "bug",
        color: "blue",
        createdAt: new Date(Date.now() + 1000),
      })
      .returning();
    await deleteLabel(root.id, member.user.id);
    expect(await labelsFor(member.workspace.id)).toEqual([newLabel]);
    expect(github).toHaveBeenCalledTimes(tasks.length);
  });
  it("prevents root renaming and reassignment while a deletion is pending", async () => {
    const { app, member, root, tasks } = await fixture(
      LABEL_DELETE_BATCH_SIZE + 1,
    );
    await deleteLabel(root.id, member.user.id);
    for (const [path, method, body] of [
      [`/api/label/${root.id}`, "PUT", { name: "renamed", color: "blue" }],
      [`/api/label/${root.id}/task`, "PUT", { taskId: tasks[0].id }],
      [
        "/api/label",
        "POST",
        {
          workspaceId: member.workspace.id,
          name: "bug",
          color: "red",
          taskId: tasks[0].id,
        },
      ],
    ] as const)
      expect(
        (
          await app.request(path, {
            method,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          })
        ).status,
      ).toBe(409);
    expect(
      (await labelsFor(member.workspace.id)).find(
        (label) => label.id === root.id,
      )?.name,
    ).toBe("bug");
  });
  it("completes an empty cascade without provider calls or events", async () => {
    const { member, root } = await fixture(0);
    expect(
      (await deleteLabel(root.id, member.user.id)).pendingDeletion,
    ).toBeUndefined();
    expect(await labelsFor(member.workspace.id)).toHaveLength(0);
    expect(github).not.toHaveBeenCalled();
    expect(gitea).not.toHaveBeenCalled();
    expect(gitlab).not.toHaveBeenCalled();
    expect(eventCalls).toHaveLength(0);
  });
  it("removes individual task labels with all providers and an awaited event", async () => {
    const { member, root, tasks } = await fixture(1);
    const [copy] = await db
      .select()
      .from(schema.labelTable)
      .where(
        and(
          eq(schema.labelTable.taskId, tasks[0].id),
          eq(schema.labelTable.workspaceId, member.workspace.id),
        ),
      );
    await deleteLabel(copy.id, member.user.id);
    expect((await labelsFor(member.workspace.id)).map((row) => row.id)).toEqual(
      [root.id],
    );
    expect(github).toHaveBeenCalledWith(tasks[0].id, "bug");
    expect(gitea).toHaveBeenCalledWith(tasks[0].id, "bug");
    expect(gitlab).toHaveBeenCalledWith(tasks[0].id, "bug");
    expect(eventCalls).toEqual([tasks[0].id]);
  });
  it("releases process and database capacity after an operation fails", async () => {
    await expect(
      withLabelDeletionLock("failure", async () => {
        throw new Error("test failure");
      }),
    ).rejects.toThrow("test failure");
    await expect(
      withLabelDeletionLock("failure", async () => "ok"),
    ).resolves.toBe("ok");
  });
  it("honors the four-slot cap held by a separate database session", async () => {
    const { app, member, root } = await fixture(0);
    const other = await getDatabasePool().connect();
    try {
      for (let i = 0; i < MAX_LABEL_DELETIONS_IN_FLIGHT; i++)
        await other.query("SELECT pg_advisory_lock(773622, $1::int)", [i]);
      await expect(
        withLabelDeletionLock("blocked", async () => "must not run"),
      ).rejects.toMatchObject({ status: 429 });
      const response = await app.request(`/api/label/${root.id}`, {
        method: "DELETE",
      });
      expect(response.status).toBe(429);
      expect(response.headers.get("Retry-After")).toBe("1");
      expect(
        (await labelsFor(member.workspace.id))[0].deletionStartedAt,
      ).toBeNull();
    } finally {
      await other.query("SELECT pg_advisory_unlock_all()");
      other.release();
    }
    await expect(
      withLabelDeletionLock("available", async () => "ok"),
    ).resolves.toBe("ok");
  });

  it("checks workspace access again when another client tries to resume", async () => {
    const { app, member, root } = await fixture(LABEL_DELETE_BATCH_SIZE + 1);
    expect(
      (await app.request(`/api/label/${root.id}`, { method: "DELETE" })).status,
    ).toBe(202);
    const other = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(other.user);
    expect(
      (await app.request(`/api/label/${root.id}`, { method: "DELETE" })).status,
    ).toBe(403);
    expect(await labelsFor(member.workspace.id)).toHaveLength(2);
    expect(github).toHaveBeenCalledTimes(LABEL_DELETE_BATCH_SIZE);
    mockAuthenticatedSession(member.user);
    expect(
      (await app.request(`/api/label/${root.id}`, { method: "DELETE" })).status,
    ).toBe(200);
  });

  it("does not lose local progress or the next event when a provider fails", async () => {
    const { member, root } = await fixture(3);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    github.mockRejectedValueOnce(new Error("provider unavailable"));
    try {
      await deleteLabel(root.id, member.user.id);
      expect(await labelsFor(member.workspace.id)).toHaveLength(0);
      expect(github).toHaveBeenCalledTimes(3);
      expect(gitea).toHaveBeenCalledTimes(3);
      expect(gitlab).toHaveBeenCalledTimes(3);
      expect(eventCalls).toHaveLength(3);
      expect(log).toHaveBeenCalledWith(
        "Failed to synchronize a label removal with an external provider",
      );
    } finally {
      log.mockRestore();
    }
  });
});

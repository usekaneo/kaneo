import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { subscribeToEvent } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import deleteLabel, {
  LABEL_DELETE_BATCH_SIZE,
} from "../../apps/api/src/label/controllers/delete-label";
import {
  MAX_LABEL_DELETIONS_IN_FLIGHT,
  withLabelDeletionLock,
} from "../../apps/api/src/label/deletion-lock";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";
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
  syncLabelToGitHub: vi.fn(async () => {}),
}));
vi.mock("../../apps/api/src/plugins/gitea/utils/sync-label-to-gitea", () => ({
  removeLabelFromGitea: gitea,
  syncLabelToGitea: vi.fn(async () => {}),
}));

vi.mock("../../apps/api/src/plugins/gitlab/utils/sync-label-to-gitlab", () => ({
  removeLabelFromGitlab: gitlab,
  syncLabelToGitlab: vi.fn(async () => {}),
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
  it("leaves no leases or advisory locks after three rounds of 24 concurrent deletes", async () => {
    for (let round = 0; round < 3; round++) {
      const { app, member, root } = await fixture(0);
      const labels = await db
        .insert(schema.labelTable)
        .values(
          Array.from({ length: 23 }, (_, i) => ({
            workspaceId: member.workspace.id,
            name: `parallel-${i}`,
            color: "red",
          })),
        )
        .returning();
      let remaining = [root, ...labels].map((label) => label.id);
      // Retry only explicit contention, with a finite bound so a leaked lock
      // fails the test instead of hanging. This also runs through PgBouncer.
      for (let attempt = 0; attempt < 24 && remaining.length; attempt++) {
        const results = await Promise.all(
          remaining.map(async (id) => {
            const response = await app.request(`/api/label/${id}`, {
              method: "DELETE",
            });
            expect([200, 429]).toContain(response.status);
            return { id, status: response.status };
          }),
        );
        remaining = results
          .filter((result) => result.status === 429)
          .map((result) => result.id);
      }
      expect(remaining).toEqual([]);
      expect(await labelsFor(member.workspace.id)).toEqual([]);
      expect(await db.query.jobLeaseTable.findMany()).toEqual([]);
      const locks =
        await db.execute(sql`SELECT count(*)::int AS count FROM pg_locks
        WHERE locktype = 'advisory' AND database = (SELECT oid FROM pg_database WHERE datname = current_database())`);
      expect(locks.rows[0]?.count).toBe(0);
    }
  });

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
  it("resumes pending effects without replaying acknowledged providers after lease loss", async () => {
    const providerIndex = 1;
    const { member, root, tasks } = await fixture(3);
    const providers = [github, gitea, gitlab];
    const provider = providers[providerIndex];
    const gate = deferred();
    provider.mockImplementationOnce(() => gate.promise);
    const pending = deleteLabel(root.id, member.user.id);
    const rejected = expect(pending).rejects.toMatchObject({ status: 429 });
    try {
      await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(1));
      await db.execute(sql`UPDATE job_lease SET expires_at = timezone('UTC', clock_timestamp()) - interval '1 second'
      WHERE name = ${`request:label-delete:resource:${root.id}`}`);
    } finally {
      gate.resolve();
    }
    await rejected;
    for (const later of providers.slice(providerIndex + 1))
      expect(later).not.toHaveBeenCalled();
    expect(eventCalls).toEqual([]);
    expect(await labelsFor(member.workspace.id)).toHaveLength(3);
    expect(await db.query.labelDeletionTable.findMany()).toMatchObject([
      {
        deletionId: root.id,
        userId: member.user.id,
        pendingEffects: ["github", "gitea", "gitlab", "event"].slice(
          providerIndex,
        ),
      },
    ]);
    expect(await db.query.jobLeaseTable.findMany()).toEqual([]);
    // A fresh HTTP request recovers from database state, including the deleted copy.
    const response = await createApp().app.request(`/api/label/${root.id}`, {
      method: "DELETE",
    });
    expect(response.status).toBe(200);
    expect(await labelsFor(member.workspace.id)).toEqual([]);
    expect(await db.query.labelDeletionTable.findMany()).toEqual([]);
    for (const [index, remove] of providers.entries()) {
      // The in-flight operation cannot be acknowledged by the expired owner.
      expect(remove).toHaveBeenCalledTimes(index === providerIndex ? 4 : 3);
      expect(new Set(remove.mock.calls.map(([id]) => id))).toEqual(
        new Set(tasks.map((task) => task.id)),
      );
    }
    expect(new Set(eventCalls)).toEqual(new Set(tasks.map((task) => task.id)));
    expect(eventCalls).toHaveLength(3);
  });

  it("replays an unacknowledged event without repeating acknowledged providers", async () => {
    const { member, root, tasks } = await fixture(1);
    const gate = deferred();
    eventGate = gate.promise;
    const pending = deleteLabel(root.id, member.user.id);
    const rejected = expect(pending).rejects.toMatchObject({ status: 429 });
    try {
      await vi.waitFor(() => expect(eventCalls).toEqual([tasks[0].id]));
      await db.execute(sql`UPDATE job_lease SET expires_at = timezone('UTC', clock_timestamp()) - interval '1 second'
        WHERE name = ${`request:label-delete:resource:${root.id}`}`);
    } finally {
      gate.resolve();
    }
    await rejected;
    expect(await db.query.labelDeletionTable.findMany()).toMatchObject([
      { pendingEffects: ["event"] },
    ]);
    await deleteLabel(root.id, member.user.id);
    expect(github).toHaveBeenCalledTimes(1);
    expect(gitea).toHaveBeenCalledTimes(1);
    expect(gitlab).toHaveBeenCalledTimes(1);
    expect(eventCalls).toEqual([tasks[0].id, tasks[0].id]);
    expect(await db.query.labelDeletionTable.findMany()).toEqual([]);
    expect(await labelsFor(member.workspace.id)).toEqual([]);
  });

  it("resumes named effects independently of provider order", async () => {
    const { member, root, tasks } = await fixture(1);
    const [copy] = await db
      .delete(schema.labelTable)
      .where(eq(schema.labelTable.taskId, tasks[0].id))
      .returning();
    await db.insert(schema.labelDeletionTable).values({
      ...copy,
      deletionId: root.id,
      userId: member.user.id,
      pendingEffects: ["gitlab", "github", "event"],
    });

    await deleteLabel(root.id, member.user.id);

    expect(gitlab).toHaveBeenCalledExactlyOnceWith(tasks[0].id, copy.name);
    expect(github).toHaveBeenCalledExactlyOnceWith(tasks[0].id, copy.name);
    expect(gitea).not.toHaveBeenCalled();
    expect(eventCalls).toEqual([tasks[0].id]);
    expect(await db.query.labelDeletionTable.findMany()).toEqual([]);
    expect(await labelsFor(member.workspace.id)).toEqual([]);
  });

  it("cleans up an acknowledged deletion without replaying effects", async () => {
    const { member, root, tasks } = await fixture(1);
    const [copy] = await db
      .delete(schema.labelTable)
      .where(eq(schema.labelTable.taskId, tasks[0].id))
      .returning();
    await db.insert(schema.labelDeletionTable).values({
      ...copy,
      deletionId: root.id,
      userId: member.user.id,
      pendingEffects: [],
    });

    await deleteLabel(root.id, member.user.id);

    expect(github).not.toHaveBeenCalled();
    expect(gitea).not.toHaveBeenCalled();
    expect(gitlab).not.toHaveBeenCalled();
    expect(eventCalls).toEqual([]);
    expect(await db.query.labelDeletionTable.findMany()).toEqual([]);
    expect(await labelsFor(member.workspace.id)).toEqual([]);
  });

  it("counts recovered copies toward the per-request batch limit", async () => {
    const { member, root } = await fixture(LABEL_DELETE_BATCH_SIZE + 1);
    github.mockImplementationOnce(async () => {
      await db.execute(sql`UPDATE job_lease SET expires_at = timezone('UTC', clock_timestamp()) - interval '1 second'
        WHERE name = ${`request:label-delete:resource:${root.id}`}`);
    });
    await expect(deleteLabel(root.id, member.user.id)).rejects.toMatchObject({
      status: 429,
    });
    expect((await deleteLabel(root.id, member.user.id)).pendingDeletion).toBe(
      true,
    );
    expect(gitea).toHaveBeenCalledTimes(LABEL_DELETE_BATCH_SIZE);
    expect(eventCalls).toHaveLength(LABEL_DELETE_BATCH_SIZE);
    expect(await labelsFor(member.workspace.id)).toHaveLength(2);
    expect(await db.query.labelDeletionTable.findMany()).toEqual([]);
    await deleteLabel(root.id, member.user.id);
    expect(eventCalls).toHaveLength(LABEL_DELETE_BATCH_SIZE + 1);
    expect(await labelsFor(member.workspace.id)).toEqual([]);
  });

  it("resumes a deleted task label over HTTP while enforcing workspace and project access", async () => {
    const { member, root, tasks, app } = await fixture(1);
    const [copy] = (await labelsFor(member.workspace.id)).filter(
      (label) => label.taskId,
    );
    github.mockImplementationOnce(async () => {
      await db.execute(sql`UPDATE job_lease SET expires_at = timezone('UTC', clock_timestamp()) - interval '1 second'
        WHERE name = ${`request:label-delete:resource:${copy.id}`}`);
    });
    const path = `/api/label/${copy.id}`;
    expect((await app.request(path, { method: "DELETE" })).status).toBe(429);
    expect(await labelsFor(member.workspace.id)).toEqual([root]);
    expect(await db.query.labelDeletionTable.findMany()).toMatchObject([
      {
        id: copy.id,
        deletionId: copy.id,
        pendingEffects: ["github", "gitea", "gitlab", "event"],
      },
    ]);
    // Only DELETE can look up the pending snapshot; other endpoints still see a deleted label.
    expect((await app.request(path)).status).toBe(404);
    expect(
      (
        await app.request(path, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "renamed", color: "blue" }),
        })
      ).status,
    ).toBe(404);
    const other = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(other.user);
    expect((await app.request(path, { method: "DELETE" })).status).toBe(404);
    const restricted = await addWorkspaceMember(member.workspace.id, "admin");
    await restrictToProjects(member.workspace.id, restricted.id, []);
    mockAuthenticatedSession(restricted);
    expect((await app.request(path, { method: "DELETE" })).status).toBe(403);
    expect(gitea).not.toHaveBeenCalled();
    mockAuthenticatedSession(member.user);
    const response = await createApp().app.request(path, { method: "DELETE" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: copy.id,
      taskId: tasks[0].id,
    });
    expect(github).toHaveBeenCalledTimes(2);
    expect(gitea).toHaveBeenCalledTimes(1);
    expect(gitlab).toHaveBeenCalledTimes(1);
    expect(eventCalls).toEqual([tasks[0].id]);
    expect(await db.query.labelDeletionTable.findMany()).toEqual([]);
    expect((await app.request(path, { method: "DELETE" })).status).toBe(404);
  });

  it("blocks reassignment until an interrupted task-label deletion finishes", async () => {
    const { member, root, tasks, app } = await fixture(1);
    const [copy] = (await labelsFor(member.workspace.id)).filter(
      (label) => label.taskId,
    );
    github.mockImplementationOnce(async () => {
      await db.execute(sql`UPDATE job_lease SET expires_at = timezone('UTC', clock_timestamp()) - interval '1 second'
        WHERE name = ${`request:label-delete:resource:${copy.id}`}`);
    });
    expect(
      (await app.request(`/api/label/${copy.id}`, { method: "DELETE" })).status,
    ).toBe(429);

    const assign = () =>
      app.request(`/api/label/${root.id}/task`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ taskId: tasks[0].id }),
      });
    expect((await assign()).status).toBe(409);
    expect(await labelsFor(member.workspace.id)).toEqual([root]);

    expect(
      (await app.request(`/api/label/${copy.id}`, { method: "DELETE" })).status,
    ).toBe(200);
    expect(await db.query.labelDeletionTable.findMany()).toEqual([]);
    expect((await assign()).status).toBe(200);
    expect(await labelsFor(member.workspace.id)).toHaveLength(2);
    expect(github).toHaveBeenCalledTimes(2);
    expect(gitea).toHaveBeenCalledTimes(1);
    expect(gitlab).toHaveBeenCalledTimes(1);
    expect(eventCalls).toEqual([tasks[0].id]);
  });

  it("preserves a replacement assigned before the pending-deletion guard was installed", async () => {
    const { member, root, tasks } = await fixture(1);
    const [copy] = (await labelsFor(member.workspace.id)).filter(
      (label) => label.taskId,
    );
    github.mockImplementationOnce(async () => {
      await db.execute(sql`UPDATE job_lease SET expires_at = timezone('UTC', clock_timestamp()) - interval '1 second'
        WHERE name = ${`request:label-delete:resource:${copy.id}`}`);
    });
    await expect(deleteLabel(copy.id, member.user.id)).rejects.toMatchObject({
      status: 429,
    });
    // Model persisted data from before the reservation guard. Keep the trigger disabled
    // only within this transaction, including on rollback if insertion fails.
    const replacement = await db.transaction(async (tx) => {
      await tx.execute(
        sql`ALTER TABLE label DISABLE TRIGGER label_pending_deletion_guard`,
      );
      const [inserted] = await tx
        .insert(schema.labelTable)
        .values({
          workspaceId: member.workspace.id,
          taskId: tasks[0].id,
          name: "bug",
          color: "blue",
        })
        .returning();
      await tx.execute(
        sql`ALTER TABLE label ENABLE TRIGGER label_pending_deletion_guard`,
      );
      return inserted;
    });
    await deleteLabel(copy.id, member.user.id);
    expect(github).toHaveBeenCalledTimes(1);
    expect(gitea).not.toHaveBeenCalled();
    expect(gitlab).not.toHaveBeenCalled();
    expect(eventCalls).toEqual([tasks[0].id]);
    expect(await db.query.labelDeletionTable.findMany()).toEqual([]);
    expect(await labelsFor(member.workspace.id)).toEqual(
      expect.arrayContaining([root, replacement]),
    );
  });

  it("rolls back a label deletion when its pending effects cannot be saved", async () => {
    const { member, root } = await fixture(1);
    await db.execute(
      sql`CREATE FUNCTION reject_label_deletion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'pending effects unavailable'; END $$`,
    );
    await db.execute(
      sql`CREATE TRIGGER reject_label_deletion BEFORE INSERT ON label_deletion FOR EACH ROW EXECUTE FUNCTION reject_label_deletion()`,
    );
    try {
      await expect(deleteLabel(root.id, member.user.id)).rejects.toThrow();
      expect(await labelsFor(member.workspace.id)).toHaveLength(2);
      expect(await db.query.labelDeletionTable.findMany()).toEqual([]);
      expect(github).not.toHaveBeenCalled();
    } finally {
      await db.execute(
        sql`DROP TRIGGER reject_label_deletion ON label_deletion`,
      );
      await db.execute(sql`DROP FUNCTION reject_label_deletion()`);
    }
    await deleteLabel(root.id, member.user.id);
    expect(eventCalls).toHaveLength(1);
    expect(await labelsFor(member.workspace.id)).toEqual([]);
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
  it("honors the four-slot cap leased by another process", async () => {
    const { app, member, root } = await fixture(0);
    await db.insert(schema.jobLeaseTable).values(
      Array.from({ length: MAX_LABEL_DELETIONS_IN_FLIGHT }, (_, i) => ({
        name: `request:label-delete:slot:${i}`,
        owner: "another-process",
        expiresAt: sql`timezone('UTC', clock_timestamp()) + interval '1 minute'`,
      })),
    );
    try {
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
      await db
        .delete(schema.jobLeaseTable)
        .where(eq(schema.jobLeaseTable.owner, "another-process"));
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
    ).toBe(404);
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
      expect(await db.query.labelDeletionTable.findMany()).toEqual([]);
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

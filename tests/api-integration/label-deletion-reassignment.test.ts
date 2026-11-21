import { eq, sql } from "drizzle-orm";
import { Client } from "pg";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import * as events from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { isPendingLabelDeletionError } from "../../apps/api/src/label/is-pending-label-deletion-error";
import { handleIssueLabeled } from "../../apps/api/src/plugins/github/webhooks/issue-labeled";
import { handleGiteaIssueLabeled } from "../../apps/api/src/plugins/gitea/webhooks/issue-labeled";
import { handleGitlabIssueUpdated } from "../../apps/api/src/plugins/gitlab/webhooks/issue-updated";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const { remove } = vi.hoisted(() => ({ remove: vi.fn(async () => {}) }));
vi.mock("../../apps/api/src/plugins/github/utils/sync-label-to-github", () => ({
  removeLabelFromGitHub: remove,
  syncLabelToGitHub: vi.fn(async () => {}),
}));
vi.mock("../../apps/api/src/plugins/gitea/utils/sync-label-to-gitea", () => ({
  removeLabelFromGitea: vi.fn(async () => {}),
  syncLabelToGitea: vi.fn(async () => {}),
}));
vi.mock("../../apps/api/src/plugins/gitlab/utils/sync-label-to-gitlab", () => ({
  removeLabelFromGitlab: vi.fn(async () => {}),
  syncLabelToGitlab: vi.fn(async () => {}),
}));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(async () => {
  await resetTestDatabase();
  remove.mockReset().mockResolvedValue();
});

async function fixture(taskIds?: [string, string]) {
  const member = await createWorkspaceMember({ role: "admin" });
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const tasks = await db
    .insert(schema.taskTable)
    .values(
      [1, 2].map((number) => ({
        id: taskIds?.[number - 1],
        projectId: project.id,
        title: `Task ${number}`,
        number,
        status: "to-do",
      })),
    )
    .returning();
  const [root, copy, other] = await db
    .insert(schema.labelTable)
    .values([
      { workspaceId: member.workspace.id, name: "bug", color: "red" },
      {
        workspaceId: member.workspace.id,
        taskId: tasks[0].id,
        name: "bug",
        color: "red",
      },
      {
        workspaceId: member.workspace.id,
        taskId: tasks[0].id,
        name: "feature",
        color: "blue",
      },
    ])
    .returning();
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  const request = (path: string, method: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: { "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const interrupt = async () => {
    remove.mockImplementationOnce(async () => {
      await db.execute(sql`UPDATE job_lease SET expires_at = timezone('UTC', clock_timestamp()) - interval '1 second'
        WHERE name = ${`request:label-delete:resource:${copy.id}`}`);
    });
    expect((await request(`/api/label/${copy.id}`, "DELETE")).status).toBe(429);
  };
  return { member, project, tasks, root, copy, other, request, interrupt };
}

describe("pending label deletion reserves the assignment", () => {
  it("rejects an assignment that races the workspace deletion transition", async () => {
    const { member, tasks, root, request } = await fixture();
    const control = new Client({ connectionString: process.env.DATABASE_URL });
    await control.connect();
    await control.query("BEGIN");
    let assigning: Promise<Response> | undefined;
    try {
      await control.query(
        "UPDATE label SET deletion_started_at = timezone('UTC', clock_timestamp()) WHERE id = $1",
        [root.id],
      );
      // The controller sees the old root; its INSERT must recheck under a lock.
      assigning = request("/api/label", "POST", {
        workspaceId: member.workspace.id,
        taskId: tasks[1].id,
        name: "bug",
        color: "red",
      });
      await vi.waitFor(async () => {
        await control.query("SELECT pg_stat_clear_snapshot()");
        const waiting = await control.query(
          "SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE 'insert into \"label\"%'",
        );
        expect(waiting.rowCount).toBe(1);
      });
      await control.query("COMMIT");
      expect((await assigning).status).toBe(409);
      expect((await request(`/api/label/${root.id}`, "DELETE")).status).toBe(
        200,
      );
      expect(
        await db.query.labelTable.findMany({
          where: eq(schema.labelTable.name, "bug"),
        }),
      ).toEqual([]);
    } finally {
      await control.query("ROLLBACK");
      await assigning;
      await control.end();
    }
  });

  it("rolls back the whole bulk assignment when one task has a pending deletion", async () => {
    const { tasks, root, copy, request, interrupt } = await fixture([
      "bulk-2",
      "bulk-1",
    ]);
    await interrupt();
    const publish = vi.spyOn(events, "publishEvent").mockResolvedValue();
    const assign = () =>
      request("/api/task/bulk", "PATCH", {
        taskIds: [tasks[0].id, tasks[1].id],
        operation: "addLabel",
        value: root.id,
      });
    expect((await assign()).status).toBe(409);
    expect(publish).not.toHaveBeenCalled();
    expect(
      await db.query.labelTable.findMany({
        where: (label, { and, isNotNull, eq }) =>
          and(isNotNull(label.taskId), eq(label.name, "bug")),
      }),
    ).toEqual([]);
    expect((await request(`/api/label/${copy.id}`, "DELETE")).status).toBe(200);
    publish.mockClear();
    expect((await assign()).status).toBe(200);
    expect(
      publish.mock.calls.filter(([type]) => type === "task.label_assigned"),
    ).toHaveLength(2);
    expect(
      await db.query.labelTable.findMany({
        where: (label, { and, isNotNull, eq }) =>
          and(isNotNull(label.taskId), eq(label.name, "bug")),
      }),
    ).toHaveLength(2);
  });

  it.each([
    { scope: "assignment", name: "bug", victim: "delete" },
    { scope: "workspace", name: "renamed", victim: "update" },
  ])(
    "recovers a concurrent $scope update/delete deadlock (name=$name)",
    async ({ scope, name, victim }) => {
      const { root, copy, request } = await fixture();
      const control = new Client({
        connectionString: process.env.DATABASE_URL,
      });
      await control.connect();
      await control.query("BEGIN");
      await control.query("SELECT pg_advisory_xact_lock(2167, 76)");
      let gateHeld = true;
      let updating: Promise<Response> | undefined;
      let deleting: Promise<Response> | undefined;
      await db.execute(sql`CREATE FUNCTION pause_label_update() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN PERFORM pg_advisory_xact_lock(2167, 76); RETURN NEW; END $$`);
      // The executor already owns the label row here. Pause before the real
      // guard takes the task lock, then let DELETE take task -> label.
      await db.execute(sql`CREATE TRIGGER aaa_pause_label_update BEFORE UPDATE ON label
      FOR EACH ROW WHEN (OLD.task_id IS NOT NULL) EXECUTE FUNCTION pause_label_update()`);
      try {
        updating = request(
          `/api/label/${scope === "workspace" ? root.id : copy.id}`,
          "PUT",
          { name, color: "green" },
        );
        await vi.waitFor(async () => {
          await control.query("SELECT pg_stat_clear_snapshot()");
          const result = await control.query(
            "SELECT 1 FROM pg_stat_activity WHERE wait_event = 'advisory' AND query LIKE 'update \"label\"%'",
          );
          expect(result.rowCount).toBe(1);
        });
        deleting = request(`/api/label/${copy.id}`, "DELETE");
        await vi.waitFor(async () => {
          await control.query("SELECT pg_stat_clear_snapshot()");
          const result = await control.query(
            "SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE 'delete from \"label\"%'",
          );
          expect(result.rowCount).toBe(1);
        });
        if (victim === "update") {
          // Let DELETE's deadlock check finish before there is a cycle, so
          // UPDATE detects the cycle and becomes the victim after release.
          const timeout = await control.query(
            "SELECT setting::int AS milliseconds FROM pg_settings WHERE name = 'deadlock_timeout'",
          );
          await new Promise((resolve) =>
            setTimeout(resolve, timeout.rows[0].milliseconds + 100),
          );
        }
        await control.query("COMMIT");
        gateHeld = false;
        const [updated, deleted] = await Promise.all([updating, deleting]);
        expect(deleted.status).toBe(200);
        // Deletion may win while an assignment edit retries. A workspace edit
        // still succeeds after its deleted copy disappears.
        expect(scope === "workspace" ? [200] : [200, 404]).toContain(
          updated.status,
        );
        expect(
          await db.query.labelTable.findFirst({
            where: eq(schema.labelTable.id, copy.id),
          }),
        ).toBeUndefined();
        expect(await db.query.labelDeletionTable.findMany()).toEqual([]);
        expect(await db.query.jobLeaseTable.findMany()).toEqual([]);
        expect(remove).toHaveBeenCalledTimes(1);
        expect(remove).toHaveBeenCalledWith(
          copy.taskId,
          (await deleted.json()).name,
        );
      } finally {
        if (gateHeld) await control.query("ROLLBACK");
        await Promise.allSettled([updating, deleting]);
        await db.execute(sql`DROP TRIGGER aaa_pause_label_update ON label`);
        await db.execute(sql`DROP FUNCTION pause_label_update()`);
        await control.end();
      }
    },
  );

  it("retries bulk assignment after a deadlock with a workspace color edit", async () => {
    const { tasks, root, request } = await fixture(["bulk-1", "bulk-2"]);
    const publish = vi.spyOn(events, "publishEvent").mockResolvedValue();
    const control = new Client({ connectionString: process.env.DATABASE_URL });
    await control.connect();
    await control.query("BEGIN");
    await control.query("SELECT pg_advisory_xact_lock(2167, 77)");
    let assigning: Promise<Response> | undefined;
    let updating: Promise<Response> | undefined;
    await db.execute(sql`CREATE FUNCTION pause_bulk_assignment() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        PERFORM id FROM task WHERE id = NEW.task_id FOR NO KEY UPDATE;
        PERFORM pg_advisory_xact_lock(2167, 77);
        RETURN NEW;
      END $$`);
    await db.execute(sql`CREATE TRIGGER aaa_pause_bulk_assignment BEFORE INSERT ON label
      FOR EACH ROW WHEN (NEW.task_id IS NOT NULL) EXECUTE FUNCTION pause_bulk_assignment()`);
    try {
      assigning = request("/api/task/bulk", "PATCH", {
        taskIds: tasks.map((task) => task.id),
        operation: "addLabel",
        value: root.id,
      });
      await vi.waitFor(async () => {
        await control.query("SELECT pg_stat_clear_snapshot()");
        const waiting = await control.query(
          "SELECT 1 FROM pg_stat_activity WHERE wait_event = 'advisory' AND query LIKE 'insert into \"label\"%'",
        );
        expect(waiting.rowCount).toBe(1);
      });
      updating = request(`/api/label/${root.id}`, "PUT", {
        name: "bug",
        color: "green",
      });
      await vi.waitFor(async () => {
        await control.query("SELECT pg_stat_clear_snapshot()");
        const waiting = await control.query(
          "SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE 'update \"label\"%'",
        );
        expect(waiting.rowCount).toBe(1);
      });
      // Let UPDATE's deadlock check run before the cycle exists. On release,
      // bulk INSERT waits for the root, detects the cycle, and is rolled back.
      const timeout = await control.query(
        "SELECT setting::int AS milliseconds FROM pg_settings WHERE name = 'deadlock_timeout'",
      );
      await new Promise((resolve) =>
        setTimeout(resolve, timeout.rows[0].milliseconds + 100),
      );
      await control.query("COMMIT");
      const [assigned, updated] = await Promise.all([assigning, updating]);
      expect(assigned.status).toBe(200);
      expect(updated.status).toBe(200);
      const labels = await db.query.labelTable.findMany({
        where: eq(schema.labelTable.name, "bug"),
      });
      expect(labels).toHaveLength(3);
      expect(labels.every((label) => label.color === "green")).toBe(true);
      const assignedEvents = publish.mock.calls.filter(
        ([type]) => type === "task.label_assigned",
      );
      expect(assignedEvents).toHaveLength(1);
      expect(assignedEvents[0]?.[1]).toMatchObject({ taskId: tasks[1].id });
    } finally {
      await control.query("ROLLBACK");
      await Promise.allSettled([assigning, updating]);
      await db.execute(sql`DROP TRIGGER aaa_pause_bulk_assignment ON label`);
      await db.execute(sql`DROP FUNCTION pause_bulk_assignment()`);
      await control.end();
    }
  });

  it.each(["update", "delete", "bulk"] as const)(
    "bounds persistent %s deadlocks without leaking effects",
    async (operation) => {
      const { copy, root, tasks, request } = await fixture();
      const publish = vi.spyOn(events, "publishEvent").mockResolvedValue();
      await db.execute(sql`CREATE FUNCTION reject_label_write() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'forced deadlock' USING ERRCODE = '40P01'; END $$`);
      await db.execute(sql`CREATE TRIGGER reject_label_write BEFORE INSERT OR UPDATE OR DELETE ON label
      FOR EACH ROW EXECUTE FUNCTION reject_label_write()`);
      try {
        const response =
          operation === "update"
            ? await request(`/api/label/${copy.id}`, "PUT", {
                name: "bug",
                color: "green",
              })
            : operation === "bulk"
              ? await request("/api/task/bulk", "PATCH", {
                  taskIds: tasks.map((task) => task.id),
                  operation: "addLabel",
                  value: root.id,
                })
              : await request(`/api/label/${copy.id}`, "DELETE");
        expect(response.status).toBe(operation === "delete" ? 429 : 409);
        if (operation === "delete")
          expect(response.headers.get("Retry-After")).toBe("1");
        expect(
          await db.query.labelTable.findFirst({
            where: eq(schema.labelTable.id, copy.id),
          }),
        ).toMatchObject({ color: "red" });
        expect(await db.query.labelDeletionTable.findMany()).toEqual([]);
        expect(await db.query.jobLeaseTable.findMany()).toEqual([]);
        expect(remove).not.toHaveBeenCalled();
        expect(publish).not.toHaveBeenCalled();
      } finally {
        await db.execute(sql`DROP TRIGGER reject_label_write ON label`);
        await db.execute(sql`DROP FUNCTION reject_label_write()`);
      }
    },
  );

  it.each(["create", "bulk", "rename", "move"] as const)(
    "blocks %s from recreating a pending assignment",
    async (operation) => {
      const { member, tasks, root, copy, other, request, interrupt } =
        await fixture();
      await interrupt();
      const [source] = await db
        .insert(schema.labelTable)
        .values({
          workspaceId: member.workspace.id,
          taskId: tasks[1].id,
          name: "bug",
          color: "red",
        })
        .returning();
      const attempt = () => {
        switch (operation) {
          case "create":
            return request("/api/label", "POST", {
              workspaceId: member.workspace.id,
              taskId: tasks[0].id,
              name: "bug",
              color: "red",
            });
          case "bulk":
            return request("/api/task/bulk", "PATCH", {
              taskIds: [tasks[0].id],
              operation: "addLabel",
              value: root.id,
            });
          case "rename":
            return request(`/api/label/${other.id}`, "PUT", {
              name: "bug",
              color: "blue",
            });
          case "move":
            return request(`/api/label/${source.id}/task`, "PUT", {
              taskId: tasks[0].id,
            });
        }
      };
      const response = await attempt();
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "CONFLICT" });
      expect(
        await db.query.labelTable.findFirst({
          where: eq(schema.labelTable.id, source.id),
        }),
      ).toBeDefined();
      expect(
        await db.query.labelTable.findFirst({
          where: eq(schema.labelTable.id, other.id),
        }),
      ).toMatchObject({ name: "feature" });
      expect((await request(`/api/label/${copy.id}`, "DELETE")).status).toBe(
        200,
      );
      expect((await attempt()).status).toBe(200);
    },
  );

  it("keeps different names and tasks writable, including after effects finish but before cleanup", async () => {
    const { member, tasks, copy, request, interrupt } = await fixture();
    await interrupt();
    await db
      .update(schema.labelDeletionTable)
      .set({ pendingEffects: [] })
      .where(eq(schema.labelDeletionTable.id, copy.id));
    for (const [taskId, name] of [
      [tasks[0].id, "unrelated"],
      [tasks[1].id, "bug"],
    ]) {
      expect(
        (
          await request("/api/label", "POST", {
            workspaceId: member.workspace.id,
            taskId,
            name,
            color: "red",
          })
        ).status,
      ).toBe(200);
    }
    expect(
      (
        await request("/api/label", "POST", {
          workspaceId: member.workspace.id,
          taskId: tasks[0].id,
          name: "bug",
          color: "red",
        })
      ).status,
    ).toBe(409);
    expect((await request(`/api/label/${copy.id}`, "DELETE")).status).toBe(200);
    expect(
      (
        await request("/api/label", "POST", {
          workspaceId: member.workspace.id,
          taskId: tasks[0].id,
          name: "bug",
          color: "red",
        })
      ).status,
    ).toBe(200);
  });

  it.each(["github", "gitea", "gitlab"] as const)(
    "%s reports a blocked incoming assignment so it can be retried",
    async (provider) => {
      const { member, project, tasks, copy, request, interrupt } =
        await fixture();
      await interrupt();
      const [integration] = await db
        .insert(schema.integrationTable)
        .values({
          projectId: project.id,
          type: provider,
          isActive: true,
          config: JSON.stringify({
            baseUrl: "https://git.example",
            accessToken: "fake-test-token",
            repositoryOwner: "team",
            repositoryName: "repo",
            projectPath: "team/repo",
            installationId: 1,
            repositoryId: 2,
            verifiedGithubAccountId: "3",
            verifiedByUserId: member.user.id,
          }),
        })
        .returning();
      await db.insert(schema.externalLinkTable).values({
        taskId: tasks[0].id,
        integrationId: integration.id,
        resourceType: "issue",
        externalId: "1",
        url: "https://git.example/team/repo/issues/1",
      });
      const receive = () => {
        switch (provider) {
          case "github":
            return handleIssueLabeled({
              action: "labeled",
              installation: { id: 1 },
              repository: { id: 2, owner: { login: "team" }, name: "repo" },
              issue: { number: 1, labels: [{ name: "bug" }] },
              label: { name: "bug", color: "ff0000" },
            });
          case "gitea":
            return handleGiteaIssueLabeled(
              {
                action: "labeled",
                repository: {
                  owner: { login: "team" },
                  name: "repo",
                  html_url: "https://git.example/team/repo",
                },
                issue: { number: 1, labels: [{ name: "bug" }] },
                label: { name: "bug", color: "ff0000" },
              },
              integration.id,
            );
          case "gitlab":
            return handleGitlabIssueUpdated(
              {
                project: {
                  name: "repo",
                  web_url: "https://git.example/team/repo",
                  path_with_namespace: "team/repo",
                },
                object_attributes: {
                  iid: 1,
                  title: "Task 1",
                  description: "",
                  url: "https://git.example/team/repo/issues/1",
                },
                changes: {
                  labels: {
                    previous: [],
                    current: [{ title: "bug", color: "#ff0000" }],
                  },
                },
              },
              integration.id,
            );
        }
      };
      await expect(receive()).rejects.toSatisfy(isPendingLabelDeletionError);
      expect((await request(`/api/label/${copy.id}`, "DELETE")).status).toBe(
        200,
      );
      await receive();
      expect(
        await db.query.labelTable.findFirst({
          where: (label, { and, eq }) =>
            and(eq(label.taskId, tasks[0].id), eq(label.name, "bug")),
        }),
      ).toBeDefined();
    },
  );

  it("does not allow assignment into the gap between deletion and saving its outbox", async () => {
    const { tasks, root, copy, request } = await fixture();
    const control = new Client({ connectionString: process.env.DATABASE_URL });
    await control.connect();
    const providerRelease = deferred();
    remove.mockImplementationOnce(() => providerRelease.promise);
    let deletion: Promise<Response> | undefined;
    let assignment: Promise<Response> | undefined;
    // Keep the test gate transaction scoped too, so it works through PgBouncer.
    await control.query("BEGIN");
    await control.query("SELECT pg_advisory_xact_lock(2167, 75)");
    let gateHeld = true;
    await db.execute(sql`CREATE FUNCTION pause_pending_label_deletion() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN PERFORM pg_advisory_xact_lock(2167, 75); RETURN NEW; END $$`);
    // PostgreSQL executes triggers alphabetically; pause before the outbox's
    // own guard so this exercises the controller's lock before DELETE.
    await db.execute(sql`CREATE TRIGGER aaa_pause_pending_label_deletion BEFORE INSERT ON label_deletion
      FOR EACH ROW EXECUTE FUNCTION pause_pending_label_deletion()`);
    try {
      deletion = request(`/api/label/${copy.id}`, "DELETE");
      await vi.waitFor(async () => {
        // Statistics snapshots are cached within the control transaction.
        await control.query("SELECT pg_stat_clear_snapshot()");
        const result = await control.query(
          "SELECT 1 FROM pg_stat_activity WHERE wait_event = 'advisory' AND query LIKE 'insert into \"label_deletion\"%'",
        );
        expect(result.rowCount).toBe(1);
      });
      assignment = request(`/api/label/${root.id}/task`, "PUT", {
        taskId: tasks[0].id,
      });
      await vi.waitFor(async () => {
        await control.query("SELECT pg_stat_clear_snapshot()");
        const result = await control.query(
          "SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE 'insert into \"label\"%'",
        );
        expect(result.rowCount).toBe(1);
      });
      await control.query("COMMIT");
      gateHeld = false;
      expect((await assignment).status).toBe(409);
      providerRelease.resolve();
      expect((await deletion).status).toBe(200);
      expect(
        (
          await request(`/api/label/${root.id}/task`, "PUT", {
            taskId: tasks[0].id,
          })
        ).status,
      ).toBe(200);
    } finally {
      if (gateHeld) await control.query("ROLLBACK");
      providerRelease.resolve();
      await Promise.allSettled([deletion, assignment]);
      await db.execute(
        sql`DROP TRIGGER aaa_pause_pending_label_deletion ON label_deletion`,
      );
      await db.execute(sql`DROP FUNCTION pause_pending_label_deletion()`);
      await control.end();
    }
  });
});

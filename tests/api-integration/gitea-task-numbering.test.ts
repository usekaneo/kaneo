import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { eq, getTableName, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { getDatabasePool, schema } from "../../apps/api/src/database";
import { importGiteaIssues } from "../../apps/api/src/gitea-integration/controllers/import-gitea-issues";
import type { GiteaConfig } from "../../apps/api/src/plugins/gitea/config";
import type * as GiteaApi from "../../apps/api/src/plugins/gitea/utils/gitea-api";
import { handleGiteaIssueOpened } from "../../apps/api/src/plugins/gitea/webhooks/issue-opened";
import createTask from "../../apps/api/src/task/controllers/create-task";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

vi.mock("../../apps/api/src/events", () => ({
  publishEvent: vi.fn(async () => undefined),
}));
vi.mock(
  "../../apps/api/src/plugins/gitea/utils/gitea-api",
  async (original) => {
    const actual = await original<typeof GiteaApi>();
    return {
      ...actual,
      createGiteaClient: (config: GiteaConfig) =>
        config.baseUrl.startsWith("http://127.0.0.1:")
          ? actual.createGiteaClient(config)
          : {
              listIssues: async () => [
                {
                  number: 1,
                  title: "Imported issue",
                  body: "Body",
                  state: "open",
                  labels: [],
                  html_url: "https://gitea.example/owner/repo/issues/1",
                },
              ],
              listPulls: async () => [],
              listIssueComments: async () => [],
            },
    };
  },
);
const repair = readFileSync(
  new URL(
    "../../apps/api/drizzle/0046_repair_task_number_counters.sql",
    import.meta.url,
  ),
  "utf8",
);
beforeEach(async () => {
  await resetTestDatabase();
});
async function setup() {
  const { user, workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  await db.insert(schema.integrationTable).values({
    projectId: project.id,
    type: "gitea",
    config: JSON.stringify({
      baseUrl: "https://gitea.example",
      accessToken: "fake-local-token",
      repositoryOwner: "owner",
      repositoryName: "repo",
    }),
  });
  return { user, project };
}

describe("Gitea import task numbers", () => {
  it("settles manual import and issue-opened without reversing project and integration locks", async () => {
    const { project } = await setup();
    const integration = await db.query.integrationTable.findFirst({
      where: eq(schema.integrationTable.projectId, project.id),
    });
    const requests: string[] = [];
    const server = createServer((request, response) => {
      const path = new URL(request.url ?? "/", "http://localhost").pathname;
      requests.push(`${request.method} ${path}`);
      response.setHeader("Content-Type", "application/json");
      if (request.method !== "GET") {
        response.statusCode = 405;
        response.end(
          JSON.stringify({ message: "Unexpected provider mutation" }),
        );
        return;
      }
      if (path === "/api/v1/repos/owner/repo/issues") {
        response.end(
          JSON.stringify([
            {
              id: 41,
              number: 41,
              title: "Manual provider issue",
              body: "Manual provider body",
              state: "open",
              labels: [],
              html_url: `${baseUrl}/owner/repo/issues/41`,
              user: { login: "provider-user" },
            },
          ]),
        );
      } else if (
        path === "/api/v1/repos/owner/repo/issues/41/comments" ||
        path === "/api/v1/repos/owner/repo/pulls"
      ) {
        response.end("[]");
      } else {
        response.statusCode = 404;
        response.end(JSON.stringify({ message: "Unexpected provider route" }));
      }
    });
    let baseUrl = "";
    const blocker = await getDatabasePool().connect();
    const pending: Promise<unknown>[] = [];
    const observe = <T>(operation: Promise<T>) => {
      pending.push(operation);
      void operation.catch(() => undefined);
      return operation;
    };
    vi.stubEnv("KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS", "true");
    try {
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Missing provider fixture port");
      baseUrl = `http://127.0.0.1:${address.port}`;
      await db
        .update(schema.integrationTable)
        .set({
          config: JSON.stringify({
            baseUrl,
            accessToken: "fake-local-token",
            repositoryOwner: "owner",
            repositoryName: "repo",
            issueSyncMode: "ingest-only",
          }),
        })
        .where(eq(schema.integrationTable.id, integration!.id));
      const payload = {
        action: "opened",
        issue: {
          number: 42,
          title: "Webhook provider issue",
          body: "Webhook provider body",
          state: "open",
          labels: [],
          html_url: `${baseUrl}/owner/repo/issues/42`,
          user: { login: "provider-user" },
        },
        repository: {
          owner: { login: "owner" },
          name: "repo",
          html_url: `${baseUrl}/owner/repo`,
        },
      };
      await blocker.query("BEGIN");
      const {
        rows: [backend],
      } = await blocker.query<{ pid: number }>(
        "select pg_backend_pid() as pid",
      );
      await blocker.query(
        `select id from "${getTableName(schema.projectTable)}" where id = $1 for update`,
        [project.id],
      );
      const waiting = () =>
        db.execute<{ pid: number }>(sql`
        select pid from pg_stat_activity
        where datname = current_database() and wait_event_type = 'Lock'
          and cardinality(pg_blocking_pids(pid)) > 0
          and ${backend!.pid} = any(pg_blocking_pids(pid))
      `);
      const manual = observe(importGiteaIssues(project.id));
      let manualPid = 0;
      await vi.waitFor(async () => {
        const result = await waiting();
        expect(result.rows).toHaveLength(1);
        manualPid = result.rows[0]!.pid;
      });
      // Observe lock ownership, not source text: import must not retain an
      // integration lock while its project lock is waiting on another session.
      let integrationUnlocked = false;
      try {
        await db.transaction(async (tx) => {
          await tx.execute(sql`
            select id from ${schema.integrationTable}
            where id = ${integration!.id} for update nowait
          `);
        });
        integrationUnlocked = true;
      } catch (error) {
        const cause =
          error instanceof Error && "cause" in error ? error.cause : error;
        if (
          !cause ||
          typeof cause !== "object" ||
          !("code" in cause) ||
          cause.code !== "55P03"
        )
          throw error;
      }
      const webhook = observe(handleGiteaIssueOpened(payload, integration!.id));
      let webhookPid = 0;
      await vi.waitFor(async () => {
        const result = await db.execute<{ pid: number }>(sql`
          select pid from pg_stat_activity
          where datname = current_database() and wait_event_type = 'Lock'
            and pid <> ${manualPid}
            and (${backend!.pid} = any(pg_blocking_pids(pid))
              or ${manualPid} = any(pg_blocking_pids(pid)))
        `);
        expect(result.rows).toHaveLength(1);
        webhookPid = result.rows[0]!.pid;
      });
      expect(webhookPid).not.toBe(manualPid);
      // The old import retained integration NOKEYUPDATE while waiting for
      // project KEY SHARE. Releasing this UPDATE gate admitted the webhook's
      // compatible project NOKEYUPDATE, creating the inverse-lock deadlock.
      await blocker.query("COMMIT");
      const [imported] = await Promise.all([manual, webhook]);
      expect(imported).toEqual({ imported: 1, updated: 0, skipped: 0 });
      expect(integrationUnlocked).toBe(true);
      await handleGiteaIssueOpened(payload, integration!.id);
      const tasks = await db.query.taskTable.findMany({
        where: eq(schema.taskTable.projectId, project.id),
      });
      const links = await db.query.externalLinkTable.findMany({
        where: eq(schema.externalLinkTable.integrationId, integration!.id),
      });
      expect(tasks).toHaveLength(2);
      expect(tasks.map((task) => task.number).sort()).toEqual([1, 2]);
      expect(new Set(links.map((link) => link.taskId)).size).toBe(2);
      expect(links.map((link) => link.externalId).sort()).toEqual(["41", "42"]);
      for (const [externalId, title] of [
        ["41", "Manual provider issue"],
        ["42", "Webhook provider issue"],
      ]) {
        const link = links.find((row) => row.externalId === externalId)!;
        expect(link).toMatchObject({
          resourceType: "issue",
          url: `${baseUrl}/owner/repo/issues/${externalId}`,
        });
        expect(tasks.find((task) => task.id === link.taskId)).toHaveProperty(
          "title",
          title,
        );
      }
      expect(
        await db.query.projectTable.findFirst({
          where: eq(schema.projectTable.id, project.id),
        }),
      ).toHaveProperty("lastTaskNumber", 2);
      expect(requests).toEqual([
        "GET /api/v1/repos/owner/repo/issues",
        "GET /api/v1/repos/owner/repo/issues/41/comments",
        "GET /api/v1/repos/owner/repo/pulls",
      ]);
    } finally {
      await blocker.query("ROLLBACK");
      blocker.release();
      await Promise.allSettled(pending);
      vi.unstubAllEnvs();
      if (server.listening) {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    }
  }, 20000);

  it("advances the shared counter before a normal task is created", async () => {
    const { user, project } = await setup();
    expect(await importGiteaIssues(project.id)).toMatchObject({ imported: 1 });
    const task = await createTask({
      projectId: project.id,
      currentUserId: user.id,
      title: "Next",
      status: "to-do",
    });
    expect(task.number).toBe(2);
    expect(
      await db.query.projectTable.findFirst({
        where: eq(schema.projectTable.id, project.id),
      }),
    ).toHaveProperty("lastTaskNumber", 2);
  });

  it("serializes import and concurrent ordinary creation through one counter", async () => {
    const { user, project } = await setup();
    const [imported] = await Promise.all([
      importGiteaIssues(project.id),
      ...Array.from({ length: 3 }, (_, index) =>
        createTask({
          projectId: project.id,
          currentUserId: user.id,
          title: `Concurrent ${index}`,
          status: "to-do",
        }),
      ),
    ]);
    expect(imported).toMatchObject({ imported: 1 });
    const tasks = await db.query.taskTable.findMany();
    expect(tasks.map((task) => task.number).sort()).toEqual([1, 2, 3, 4]);
  });

  it("repairs a legacy counter without renumbering existing references, and is idempotent", async () => {
    const { user, project } = await setup();
    await db.insert(schema.taskTable).values([
      { projectId: project.id, title: "Legacy import", number: 42 },
      { projectId: project.id, title: "Earlier task", number: 41 },
    ]);
    await db.execute(sql.raw(repair));
    await db.execute(sql.raw(repair));
    const task = await createTask({
      projectId: project.id,
      currentUserId: user.id,
      title: "After upgrade",
      status: "to-do",
    });
    expect(task.number).toBe(43);
    const tasks = await db.query.taskTable.findMany();
    expect(tasks.map((row) => row.number).sort()).toEqual([41, 42, 43]);
  });

  it("never lowers a high-water counter when the highest task was deleted", async () => {
    const { project } = await setup();
    await db
      .update(schema.projectTable)
      .set({ lastTaskNumber: 100 })
      .where(eq(schema.projectTable.id, project.id));
    await db
      .insert(schema.taskTable)
      .values({ projectId: project.id, title: "Older task", number: 1 });
    await db.execute(sql.raw(repair));
    expect(await importGiteaIssues(project.id)).toMatchObject({ imported: 1 });
    expect(
      await db.query.projectTable.findFirst({
        where: eq(schema.projectTable.id, project.id),
      }),
    ).toHaveProperty("lastTaskNumber", 101);
  });
});

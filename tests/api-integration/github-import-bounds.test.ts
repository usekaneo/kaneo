import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import db, { getDatabasePool, schema } from "../../apps/api/src/database";
import { importIssues } from "../../apps/api/src/github-integration/controllers/import-issues";
import { withGithubImportLock } from "../../apps/api/src/github-integration/import-lock";
import { IMPORT_PAGES_PER_REQUEST } from "../../apps/api/src/github-integration/import-pages";
import { createApp } from "../../apps/api/src/index";
import { handleIssueOpened } from "../../apps/api/src/plugins/github/webhooks/issue-opened";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const mocks = vi.hoisted(() => ({
  graphql: vi.fn(),
  verify: vi.fn(),
  comment: vi.fn(),
}));
vi.mock("../../apps/api/src/plugins/github/utils/github-app", () => ({
  getVerifiedInstallationOctokit: mocks.verify,
  getGithubApp: () => ({
    getInstallationOctokit: async () => ({
      rest: { issues: { createComment: mocks.comment } },
    }),
  }),
}));
const old = "2020-01-01T00:00:00Z";
function connection<T>(
  nodes: T[],
  more = false,
  cursor: string | null = null,
  totalCount = nodes.length,
) {
  return {
    nodes,
    totalCount,
    pageInfo: { hasNextPage: more, endCursor: cursor },
  };
}
function issue(number: number, options: Record<string, unknown> = {}) {
  return {
    number,
    title: `Issue ${number}`,
    body: "Description",
    url: `https://github.com/example/repo/issues/${number}`,
    state: "OPEN",
    createdAt: old,
    author: null,
    labels: connection([]),
    comments: connection([]),
    ...options,
  };
}
function comment(number: number, options: Record<string, unknown> = {}) {
  return {
    body: `Comment ${number}`,
    url: `https://github.com/example/repo/issues/1#issuecomment-${number}`,
    createdAt: old,
    author: {
      login: "contributor",
      avatarUrl: "https://avatars.githubusercontent.com/u/1",
      __typename: "User",
    },
    ...options,
  };
}
function label(number: number) {
  return { name: `label-${number}`, color: "abcdef" };
}
function issuePage(
  nodes: ReturnType<typeof issue>[],
  more = false,
  cursor: string | null = null,
  total = nodes.length,
) {
  return {
    repository: {
      databaseId: 2,
      issues: connection(nodes, more, cursor, total),
    },
  };
}
const emptyPulls = () => ({
  repository: { databaseId: 2, pullRequests: connection([]) },
});
function serveIssues(count: number) {
  mocks.graphql.mockImplementation(
    async (query: string, variables: { cursor: string | null }) => {
      if (query.includes("query ImportPullRequests(")) return emptyPulls();
      const number = Number(variables.cursor ?? 0) + 1;
      return issuePage([issue(number)], number < count, String(number), count);
    },
  );
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
beforeEach(async () => {
  await resetTestDatabase();
  mocks.graphql.mockReset();
  mocks.verify.mockReset().mockResolvedValue({ graphql: mocks.graphql });
  mocks.comment.mockReset();
});
async function setup() {
  const member = await createWorkspaceMember({ role: "admin" });
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const config = {
    repositoryOwner: "example",
    repositoryName: "repo",
    installationId: 1,
    repositoryId: 2,
    verifiedGithubAccountId: "3",
    verifiedByUserId: member.user.id,
    commentTaskLinkOnGitHubIssue: false,
  };
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({
      projectId: project.id,
      type: "github",
      isActive: true,
      config: JSON.stringify(config),
    })
    .returning();
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  const request = (runId?: string) =>
    app.request("/api/github-integration/import-issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        ...(runId ? { runId } : {}),
      }),
    });
  return { member, project, columns, integration, config, app, request };
}
async function saved() {
  return db.query.githubImportTable.findFirst();
}

describe("bounded resumable GitHub import", () => {
  it("bounds each HTTP step, persists resumable state, imports every issue and retries completion without restarting", async () => {
    const { request, app, project } = await setup();
    serveIssues(9);
    const first = await request();
    expect(first.status).toBe(202);
    const progress = await first.json();
    expect(progress).toMatchObject({
      pending: true,
      imported: IMPORT_PAGES_PER_REQUEST,
      updated: 0,
    });
    expect(mocks.graphql).toHaveBeenCalledTimes(IMPORT_PAGES_PER_REQUEST);
    const info = await app.request(
      `/api/github-integration/project/${project.id}`,
    );
    expect((await info.json()).importProgress).toEqual(progress);
    let response = await request(progress.runId);
    expect(response.status).toBe(202);
    response = await request(progress.runId);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      pending: false,
      imported: 9,
    });
    expect(await db.query.taskTable.findMany()).toHaveLength(9);
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(9);
    const calls = mocks.graphql.mock.calls.length;
    expect((await request(progress.runId)).status).toBe(200);
    expect(mocks.graphql).toHaveBeenCalledTimes(calls);
    expect(await db.query.githubImportTable.findMany()).toHaveLength(1);
    expect(mocks.verify).toHaveBeenCalledWith(expect.anything(), true);
  });

  it("resumes after provider failure without replaying committed pages or leaking provider errors", async () => {
    const { request, project } = await setup();
    serveIssues(7);
    const original = mocks.graphql.getMockImplementation();
    if (!original) throw new Error("Expected provider mock");
    mocks.graphql.mockImplementation(async (query, vars) => {
      if (vars.cursor === "2") throw new Error("private-token-provider-url");
      return original(query, vars);
    });
    const failed = await request();
    expect(failed.status).toBe(502);
    expect(await failed.text()).not.toContain("private-token");
    expect(await db.query.taskTable.findMany()).toHaveLength(2);
    expect((await saved())?.state).toMatchObject({
      imported: 2,
      issueCursor: "2",
    });
    mocks.graphql.mockImplementation(original);
    let result = await importIssues(project.id);
    while (result.pending)
      result = await importIssues(project.id, result.runId);
    expect(result).toMatchObject({ imported: 7, updated: 0 });
    expect(await db.query.taskTable.findMany()).toHaveLength(7);
  });

  it("processes all label and comment pages, applies late system labels and deduplicates comments on reimport", async () => {
    const { project, columns } = await setup();
    const labels = Array.from({ length: 27 }, (_, n) => label(n));
    labels[25] = { name: "status:in-progress", color: "ffffff" };
    labels[26] = { name: "priority:urgent", color: "ffffff" };
    const comments = Array.from({ length: 85 }, (_, n) => comment(n));
    comments[2] = comment(2, {
      author: {
        login: "robot",
        avatarUrl: "https://example.test/a",
        __typename: "Bot",
      },
    });
    comments[3] = comment(3, {
      author: {
        login: "robot[bot]",
        avatarUrl: "https://example.test/a",
        __typename: "User",
      },
    });
    comments[84] = comment(84, { createdAt: "2099-01-01T00:00:00Z" });
    mocks.graphql.mockImplementation(
      async (query: string, vars: { cursor: string | null }) => {
        if (query.includes("query ImportIssues("))
          return issuePage([
            issue(1, {
              labels: connection(labels.slice(0, 25), true, "25", 27),
              comments: connection(comments.slice(0, 20), true, "20", 85),
            }),
          ]);
        if (query.includes("query ImportIssueLabels("))
          return {
            repository: {
              databaseId: 2,
              issue: { labels: connection(labels.slice(25), false, "27", 27) },
            },
          };
        if (query.includes("query ImportIssueComments(")) {
          const offset = Number(vars.cursor);
          const end = Math.min(85, offset + 20);
          return {
            repository: {
              databaseId: 2,
              issue: {
                comments: connection(
                  comments.slice(offset, end),
                  end < 85,
                  String(end),
                  85,
                ),
              },
            },
          };
        }
        return emptyPulls();
      },
    );
    let result = await importIssues(project.id);
    expect(result.pending).toBe(true);
    expect((await saved())?.state).toMatchObject({
      phase: "comments",
      currentIssue: { commentCursor: "60", labelsRemaining: 0 },
    });
    result = await importIssues(project.id, result.runId);
    expect(result.pending).toBe(false);
    expect(await db.query.labelTable.findMany()).toHaveLength(25);
    expect(await db.query.activityTable.findMany()).toHaveLength(82);
    expect(await db.query.taskTable.findFirst()).toMatchObject({
      priority: "urgent",
      status: "in-progress",
      columnId: columns.inProgress.id,
    });
    result = await importIssues(project.id);
    while (result.pending)
      result = await importIssues(project.id, result.runId);
    expect(result).toMatchObject({ imported: 0, updated: 1 });
    expect(await db.query.activityTable.findMany()).toHaveLength(82);
    expect(await db.query.labelTable.findMany()).toHaveLength(25);
  });

  it("does not chase comments added after the initial count or issues after the import boundary", async () => {
    const { project } = await setup();
    mocks.graphql.mockImplementation(async (query: string) => {
      if (query.includes("query ImportIssues("))
        return issuePage([
          issue(1, {
            comments: connection(
              Array.from({ length: 20 }, (_, n) => comment(n)),
              true,
              "20",
              21,
            ),
          }),
        ]);
      if (query.includes("query ImportIssueComments("))
        return {
          repository: {
            databaseId: 2,
            issue: {
              comments: connection(
                Array.from({ length: 20 }, (_, n) => comment(20 + n)),
                true,
                "40",
                99999,
              ),
            },
          },
        };
      return emptyPulls();
    });
    expect(await importIssues(project.id)).toMatchObject({
      pending: false,
      imported: 1,
    });
    expect(await db.query.activityTable.findMany()).toHaveLength(21);
    mocks.graphql.mockImplementation(async (query: string) =>
      query.includes("query ImportIssues(")
        ? issuePage(
            [issue(2, { createdAt: "2099-01-01T00:00:00Z" })],
            true,
            "2",
            999,
          )
        : emptyPulls(),
    );
    expect(await importIssues(project.id)).toMatchObject({
      pending: false,
      imported: 0,
    });
    expect(await db.query.taskTable.findMany()).toHaveLength(1);
  });

  it("rolls back task, link, comments, number allocation and cursor together when saving progress fails", async () => {
    const { project } = await setup();
    serveIssues(1);
    await db.execute(
      sql.raw(
        `CREATE FUNCTION fail_import_progress() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$`,
      ),
    );
    await db.execute(
      sql.raw(
        "CREATE TRIGGER fail_import_progress BEFORE UPDATE ON github_import FOR EACH ROW EXECUTE FUNCTION fail_import_progress()",
      ),
    );
    try {
      await expect(importIssues(project.id)).rejects.toThrow();
      expect(await db.query.taskTable.findMany()).toHaveLength(0);
      expect(await db.query.externalLinkTable.findMany()).toHaveLength(0);
      expect((await saved())?.state).toMatchObject({
        phase: "issues",
        issueCursor: null,
        imported: 0,
      });
      expect(await db.query.projectTable.findFirst()).toMatchObject({
        lastTaskNumber: 0,
      });
    } finally {
      await db.execute(
        sql.raw("DROP TRIGGER fail_import_progress ON github_import"),
      );
      await db.execute(sql.raw("DROP FUNCTION fail_import_progress()"));
    }
    expect(await importIssues(project.id)).toMatchObject({
      imported: 1,
      pending: false,
    });
    expect(await db.query.taskTable.findFirst()).toMatchObject({ number: 1 });
  });

  it("rechecks workspace access on every continuation and keeps state scoped to its integration", async () => {
    const { request, project, app } = await setup();
    serveIssues(7);
    const first = await (await request()).json();
    const calls = mocks.graphql.mock.calls.length;
    const other = await createWorkspaceMember({ role: "admin" });
    mockAuthenticatedSession(other.user);
    expect((await request(first.runId)).status).toBe(403);
    expect(
      (await app.request(`/api/github-integration/project/${project.id}`))
        .status,
    ).toBe(403);
    expect(mocks.graphql).toHaveBeenCalledTimes(calls);
  });

  it("rejects wrong run IDs and changed repository identities without consuming old cursors", async () => {
    const { project, integration, config } = await setup();
    serveIssues(7);
    const first = await importIssues(project.id);
    await expect(
      importIssues(project.id, "not-this-run"),
    ).rejects.toMatchObject({ status: 409 });
    await db
      .update(schema.integrationTable)
      .set({ config: JSON.stringify({ ...config, repositoryId: 22 }) })
      .where(eq(schema.integrationTable.id, integration.id));
    await expect(importIssues(project.id, first.runId)).rejects.toMatchObject({
      status: 409,
    });
    expect(mocks.graphql).toHaveBeenCalledTimes(4);
  });

  it("does not commit a fetched page after the integration is disabled", async () => {
    const { project, integration } = await setup();
    mocks.graphql.mockImplementation(async () => {
      await db
        .update(schema.integrationTable)
        .set({ isActive: false })
        .where(eq(schema.integrationTable.id, integration.id));
      return issuePage([issue(1)]);
    });
    await expect(importIssues(project.id)).rejects.toMatchObject({
      status: 409,
    });
    expect(await db.query.taskTable.findMany()).toHaveLength(0);
  });

  it.each(["identity", "cursor", "oversized"])(
    "rejects invalid provider %s without advancing saved progress",
    async (kind) => {
      const { project } = await setup();
      mocks.graphql.mockResolvedValue(
        kind === "identity"
          ? {
              ...issuePage([issue(1)]),
              repository: {
                ...issuePage([issue(1)]).repository,
                databaseId: 99,
              },
            }
          : kind === "cursor"
            ? issuePage([issue(1)], true, null)
            : issuePage([issue(1), issue(2)]),
      );
      await expect(importIssues(project.id)).rejects.toMatchObject({
        status: kind === "identity" ? 409 : 502,
      });
      expect((await saved())?.state.imported).toBe(0);
      expect(await db.query.taskTable.findMany()).toHaveLength(0);
    },
  );

  it("pauses on an empty unfinished page instead of silently dropping remaining issues", async () => {
    const { project } = await setup();
    mocks.graphql.mockResolvedValue(issuePage([], true, "next", 10));
    await expect(importIssues(project.id)).rejects.toMatchObject({
      status: 502,
    });
    expect((await saved())?.state).toMatchObject({
      imported: 0,
      issueCursor: null,
    });
  });

  it("does not loop on a repeated cursor and retains earlier pages", async () => {
    const { project } = await setup();
    mocks.graphql.mockResolvedValue(issuePage([issue(1)], true, "same", 100));
    await expect(importIssues(project.id)).rejects.toMatchObject({
      status: 502,
    });
    expect(mocks.graphql).toHaveBeenCalledTimes(2);
    expect((await saved())?.state).toMatchObject({
      imported: 1,
      issueCursor: "same",
    });
    expect(await db.query.taskTable.findMany()).toHaveLength(1);
  });

  it("finishes a disappeared source without losing other issues or modifying another project's task", async () => {
    const { project } = await setup();
    mocks.graphql.mockImplementation(
      async (query: string, vars: { cursor: string | null }) => {
        if (query.includes("query ImportIssues("))
          return vars.cursor
            ? issuePage([issue(2)])
            : issuePage(
                [
                  issue(1, {
                    comments: connection([comment(1)], true, "first", 100),
                  }),
                ],
                true,
                "1",
                2,
              );
        if (query.includes("query ImportIssueComments("))
          return { repository: { databaseId: 2, issue: null } };
        return emptyPulls();
      },
    );
    expect(await importIssues(project.id)).toMatchObject({
      pending: false,
      imported: 2,
      skipped: 1,
    });
    expect(await db.query.taskTable.findMany()).toHaveLength(2);
  });

  it("deleting an integration removes its saved progress but preserves imported tasks", async () => {
    const { project, integration } = await setup();
    serveIssues(8);
    await importIssues(project.id);
    await db
      .delete(schema.integrationTable)
      .where(eq(schema.integrationTable.id, integration.id));
    expect(await saved()).toBeUndefined();
    expect(await db.query.taskTable.findMany()).toHaveLength(4);
  });

  it("limits simultaneous imports across processes and releases slots after failure", async () => {
    const client = await getDatabasePool().connect();
    await client.query(
      "SELECT pg_advisory_lock(773623, 0), pg_advisory_lock(773623, 1)",
    );
    try {
      await expect(
        withGithubImportLock("any", async () => {}),
      ).rejects.toMatchObject({ status: 429 });
    } finally {
      await client.query("SELECT pg_advisory_unlock_all()");
      client.release();
    }
    await expect(
      withGithubImportLock("any", async () => {
        throw new Error("failed");
      }),
    ).rejects.toThrow("failed");
    expect(await withGithubImportLock("any", async () => "free")).toBe("free");
  });

  it("rejects overlapping steps for one project and permits later continuation", async () => {
    const { project, request } = await setup();
    serveIssues(1);
    const gate = deferred();
    const started = deferred();
    const original = mocks.graphql.getMockImplementation();
    if (!original) throw new Error("Expected provider mock");
    mocks.graphql.mockImplementation(async (query, vars) => {
      started.resolve();
      await gate.promise;
      return original(query, vars);
    });
    const first = importIssues(project.id);
    await started.promise;
    try {
      const busy = await request();
      expect(busy.status).toBe(429);
      expect(busy.headers.get("Retry-After")).toBe("1");
    } finally {
      gate.resolve();
    }
    expect(await first).toMatchObject({ pending: false, imported: 1 });
  });

  it("coordinates webhook creation with imports so both paths create only one task and link", async () => {
    const { project } = await setup();
    serveIssues(1);
    const payload = {
      action: "opened",
      installation: { id: 1 },
      repository: {
        id: 2,
        owner: { login: "example" },
        name: "repo",
        full_name: "example/repo",
      },
      issue: {
        number: 1,
        title: "Issue 1",
        body: "Description",
        html_url: "https://github.com/example/repo/issues/1",
        user: null,
      },
    };
    await Promise.all([
      importIssues(project.id),
      handleIssueOpened(payload),
      handleIssueOpened(payload),
    ]);
    expect(await db.query.taskTable.findMany()).toHaveLength(1);
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(1);
    expect(mocks.comment).not.toHaveBeenCalled();
  });

  it("continues all pull request pages and links only matching tasks in this project", async () => {
    const { project, integration } = await setup();
    mocks.graphql.mockImplementation(
      async (query: string, vars: { cursor: string | null }) => {
        if (query.includes("query ImportIssues(")) return issuePage([issue(1)]);
        const offset = Number(vars.cursor ?? 0);
        const end = Math.min(25, offset + 10);
        const pulls = Array.from({ length: end - offset }, (_, index) => ({
          number: offset + index + 1,
          title: `${project.slug.toUpperCase()}-1`,
          body: null,
          url: `https://github.com/example/repo/pull/${offset + index + 1}`,
          state: "OPEN",
          createdAt: old,
          headRefName: `${project.slug.toLowerCase()}-1`,
          author: null,
        }));
        return {
          repository: {
            databaseId: 2,
            pullRequests: connection(pulls, end < 25, String(end), 25),
          },
        };
      },
    );
    const result = await importIssues(project.id);
    expect(result.pending).toBe(false);
    expect(
      await db
        .select()
        .from(schema.externalLinkTable)
        .where(
          and(
            eq(schema.externalLinkTable.resourceType, "pull_request"),
            eq(schema.externalLinkTable.integrationId, integration.id),
          ),
        ),
    ).toHaveLength(25);
  });
});

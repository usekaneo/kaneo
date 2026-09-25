import { createHmac } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { importGiteaIssues } from "../../apps/api/src/gitea-integration/controllers/import-gitea-issues";
import { importIssues } from "../../apps/api/src/github-integration/controllers/import-issues";
import { handleGiteaWebhookRequest } from "../../apps/api/src/plugins/gitea/webhook-handler";
import { handleGiteaPullRequestClosed } from "../../apps/api/src/plugins/gitea/webhooks/pull-request-closed";
import { handleGiteaPullRequestOpened } from "../../apps/api/src/plugins/gitea/webhooks/pull-request-opened";
import { resolvePullRequestTask } from "../../apps/api/src/plugins/github/services/resolve-pull-request-task";
import { handlePullRequestClosed } from "../../apps/api/src/plugins/github/webhooks/pull-request-closed";
import { handlePullRequestOpened } from "../../apps/api/src/plugins/github/webhooks/pull-request-opened";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const remote = vi.hoisted(() => ({ listIssues: vi.fn(), listPulls: vi.fn() }));
vi.mock("../../apps/api/src/plugins/github/utils/github-app", () => ({
  getVerifiedInstallationOctokit: async () => ({
    graphql: async (query: string) => ({
      repository: {
        databaseId: 2,
        ...(query.includes("query ImportIssues(")
          ? {
              issues: {
                totalCount: 0,
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [],
              },
            }
          : {
              pullRequests: {
                totalCount: (await remote.listPulls()).length,
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: (await remote.listPulls()).map(
                  (pull: {
                    number: number;
                    title: string;
                    body: string | null;
                    html_url: string;
                    state: string;
                    head: { ref: string };
                  }) => ({
                    number: pull.number,
                    title: pull.title,
                    body: pull.body,
                    url: pull.html_url,
                    state: pull.state.toUpperCase(),
                    headRefName: pull.head.ref,
                    createdAt: "2020-01-01T00:00:00Z",
                    author: null,
                  }),
                ),
              },
            }),
      },
    }),
  }),
}));
vi.mock("../../apps/api/src/plugins/gitea/utils/gitea-api", () => ({
  createGiteaClient: () => ({
    listIssues: remote.listIssues,
    listPulls: remote.listPulls,
  }),
}));

async function createFixture(
  provider: "github" | "gitea",
  slug = "KAN",
  repo = "repo",
) {
  const member = await createWorkspaceMember();
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
    slug,
  });
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({
      projectId: project.id,
      type: provider,
      isActive: true,
      config: JSON.stringify({
        repositoryOwner: "acme",
        repositoryName: repo,
        installationId: 1,
        repositoryId: repo === "repo" ? 2 : 3,
        verifiedGithubAccountId: "4",
        verifiedByUserId: member.user.id,
        accessToken: "test-only-token",
        webhookSecret: "test-only-webhook-secret",
        baseUrl: "https://git.example.com",
        branchPattern: "{slug}-{number}",
      }),
    })
    .returning();
  const tasks = await db
    .insert(schema.taskTable)
    .values(
      [42, 61].map((number) => ({
        projectId: project.id,
        number,
        title: `Task ${number}`,
        status: "to-do",
        columnId: columns.todo.id,
        priority: "medium",
        position: number,
      })),
    )
    .returning();
  return {
    project,
    columns,
    integration,
    intended: tasks[0],
    unrelated: tasks[1],
  };
}

describe.each(["github", "gitea"] as const)(
  "%s pull request task identity",
  (provider) => {
    let fixture: Awaited<ReturnType<typeof createFixture>>;
    const repositoryUrl =
      provider === "github"
        ? "https://github.com/acme/repo"
        : "https://git.example.com/acme/repo";
    const payload = (
      title = "Copy message text",
      body = "Closes #61",
      branch = "unmatched-branch",
    ) => ({
      action: "opened",
      installation: { id: 1 },
      repository: {
        id: 2,
        owner: { login: "acme" },
        name: "repo",
        html_url: repositoryUrl,
      },
      pull_request: {
        number: 109,
        title,
        body,
        head: { ref: branch },
        html_url: `${repositoryUrl}/pull/109`,
        state: "open",
        draft: false,
        merged: false,
        user: { login: "octocat" },
      },
    });
    const runImport = async () => {
      if (provider === "gitea") {
        const result = await importGiteaIssues(fixture.project.id);
        expect(result.errors).toBeUndefined();
        return;
      }
      let result = await importIssues(fixture.project.id);
      for (let attempt = 0; result.pending && attempt < 10; attempt++) {
        result = await importIssues(fixture.project.id, result.runId);
      }
      expect(result.pending).toBe(false);
    };
    const open = (event = payload()) =>
      provider === "github"
        ? handlePullRequestOpened(event)
        : handleGiteaPullRequestOpened(event, fixture.integration.id);
    const openUnscoped = (event = payload()) =>
      provider === "github"
        ? handlePullRequestOpened(event)
        : handleGiteaPullRequestOpened(event);
    const openSigned = async () => {
      const body = JSON.stringify(payload());
      const signature = createHmac("sha256", "test-only-webhook-secret")
        .update(body)
        .digest("hex");
      expect(
        await handleGiteaWebhookRequest(
          fixture.integration.id,
          body,
          signature,
          "pull_request",
        ),
      ).toEqual({ success: true });
    };
    const linkIssue = (
      taskId: string,
      externalId = "61",
      integrationId = fixture.integration.id,
      resourceType = "issue",
    ) =>
      db.insert(schema.externalLinkTable).values({
        taskId,
        integrationId,
        resourceType,
        externalId,
        url: `${repositoryUrl}/issues/${externalId}`,
      });
    const links = () =>
      db.query.externalLinkTable.findMany({
        where: and(
          eq(schema.externalLinkTable.resourceType, "pull_request"),
          eq(schema.externalLinkTable.externalId, "109"),
        ),
      });
    const task = (id: string) =>
      db.query.taskTable.findFirst({ where: eq(schema.taskTable.id, id) });
    const expectUnchanged = async () => {
      expect(await links()).toHaveLength(0);
      expect((await task(fixture.intended.id))?.status).toBe("to-do");
      expect((await task(fixture.unrelated.id))?.status).toBe("to-do");
    };

    beforeEach(async () => {
      await resetTestDatabase();
      fixture = await createFixture(provider);
      vi.clearAllMocks();
      remote.listIssues.mockResolvedValue([]);
      remote.listPulls.mockResolvedValue([payload().pull_request]);
    });

    it("links remote issue 61 to task 42 without advancing local task 61", async () => {
      await linkIssue(fixture.intended.id);
      await open();
      expect(await links()).toMatchObject([{ taskId: fixture.intended.id }]);
      expect(await task(fixture.intended.id)).toMatchObject({
        status: "in-review",
        columnId: fixture.columns.inReview.id,
      });
      expect((await task(fixture.unrelated.id))?.status).toBe("to-do");
    });

    it("checks for an existing PR link only once per integration", async () => {
      await linkIssue(fixture.intended.id);
      const lookup = vi.spyOn(db.query.externalLinkTable, "findFirst");
      await open();
      expect(lookup).toHaveBeenCalledTimes(1);
      expect(await links()).toMatchObject([{ taskId: fixture.intended.id }]);
    });

    it("does not let a separatorless task label override the linked issue", async () => {
      await linkIssue(fixture.intended.id);
      await open(payload("Refactor task61 renderer"));
      expect(await links()).toMatchObject([{ taskId: fixture.intended.id }]);
      expect((await task(fixture.unrelated.id))?.status).toBe("to-do");
    });

    it("merges the mapped task without completing the same-numbered local task", async () => {
      await linkIssue(fixture.intended.id);
      await open();
      const event = payload();
      const closed = {
        ...event,
        action: "closed",
        pull_request: {
          ...event.pull_request,
          state: "closed",
          merged: true,
          merged_at: "2026-01-01T00:00:00Z",
        },
      };
      if (provider === "github") await handlePullRequestClosed(closed);
      else await handleGiteaPullRequestClosed(closed);
      expect((await task(fixture.intended.id))?.status).toBe("done");
      expect((await task(fixture.unrelated.id))?.status).toBe("to-do");
    });

    it("imports a PR using the remote issue mapping", async () => {
      await linkIssue(fixture.intended.id);
      await runImport();
      expect(await links()).toMatchObject([{ taskId: fixture.intended.id }]);
      expect((await task(fixture.unrelated.id))?.status).toBe("to-do");
    });

    it("imports an explicit task key without an issue link", async () => {
      remote.listPulls.mockResolvedValue([
        payload("KAN-42: Fix copy", "").pull_request,
      ]);
      await runImport();
      expect(await links()).toMatchObject([{ taskId: fixture.intended.id }]);
      expect((await task(fixture.unrelated.id))?.status).toBe("to-do");
    });

    it("resolves issue links written inside the import transaction", async () => {
      await db.transaction(async (tx) => {
        await tx.insert(schema.externalLinkTable).values({
          taskId: fixture.intended.id,
          integrationId: fixture.integration.id,
          resourceType: "issue",
          externalId: "61",
          url: `${repositoryUrl}/issues/61`,
        });
        const resolved = await resolvePullRequestTask({
          integrationId: fixture.integration.id,
          projectId: fixture.project.id,
          projectSlug: fixture.project.slug,
          config: { branchPattern: "{slug}-{number}" },
          repositoryUrl,
          pullRequest: payload().pull_request,
          database: tx,
        });
        expect(resolved?.id).toBe(fixture.intended.id);
      });
    });

    it("does not import a PR without a matching issue link", async () => {
      await runImport();
      await expectUnchanged();
    });

    it("preserves an existing PR association during import", async () => {
      await linkIssue(fixture.intended.id);
      await linkIssue(
        fixture.unrelated.id,
        "109",
        fixture.integration.id,
        "pull_request",
      );
      await runImport();
      expect(await links()).toMatchObject([{ taskId: fixture.unrelated.id }]);
      expect((await task(fixture.intended.id))?.status).toBe("to-do");
      expect((await task(fixture.unrelated.id))?.status).toBe("to-do");
    });

    it("accepts duplicate issue links pointing to the same task", async () => {
      await linkIssue(fixture.intended.id);
      await linkIssue(fixture.intended.id);
      await open();
      expect(await links()).toMatchObject([{ taskId: fixture.intended.id }]);
    });

    it("recognizes a project key in a conventional commit title", async () => {
      await open(
        payload(
          "feat(KAN-42): copy message text",
          "Closes #61",
          "codex/kan-42-copy-message-text",
        ),
      );
      expect(await links()).toMatchObject([{ taskId: fixture.intended.id }]);
      expect((await task(fixture.unrelated.id))?.status).toBe("to-do");
    });

    it("does not infer a local task from an unmapped remote issue", async () => {
      await open();
      await expectUnchanged();
    });

    it("does not use an issue link from another integration", async () => {
      const other = await createFixture(provider, "OTHER", "other-repo");
      await linkIssue(fixture.intended.id, "61", other.integration.id);
      await open();
      await expectUnchanged();
    });

    it("does not use a branch link as an issue link", async () => {
      await linkIssue(
        fixture.intended.id,
        "61",
        fixture.integration.id,
        "branch",
      );
      await open();
      await expectUnchanged();
    });

    it("does not use an issue link whose task belongs to another project", async () => {
      const other = await createFixture(provider, "OTHER", "other-repo");
      await linkIssue(other.intended.id);
      await open();
      await expectUnchanged();
      expect((await task(other.intended.id))?.status).toBe("to-do");
    });

    it("skips conflicting duplicate issue links", async () => {
      await linkIssue(fixture.intended.id);
      await linkIssue(fixture.unrelated.id);
      await open();
      await expectUnchanged();
    });

    it("skips closing references mapped to different tasks", async () => {
      await linkIssue(fixture.intended.id);
      await linkIssue(fixture.unrelated.id, "88");
      await open(payload("Copy message text", "Closes #61, fixes #88"));
      await expectUnchanged();
    });

    it("accepts multiple issue links to the same task", async () => {
      await linkIssue(fixture.intended.id);
      await linkIssue(fixture.intended.id, "88");
      await open(payload("Copy message text", "Closes #61, fixes #88"));
      expect(await links()).toMatchObject([{ taskId: fixture.intended.id }]);
    });

    it("preserves explicit branch precedence over an issue reference", async () => {
      await linkIssue(fixture.unrelated.id);
      await open(payload("Copy message text", "Closes #61", "kan-42-copy"));
      expect(await links()).toMatchObject([{ taskId: fixture.intended.id }]);
    });

    it("preserves an existing PR association on a reopened delivery", async () => {
      await linkIssue(
        fixture.unrelated.id,
        "109",
        fixture.integration.id,
        "pull_request",
      );
      await open({
        ...payload("fix(KAN-42): copy message text"),
        action: "reopened",
      });
      expect(await links()).toMatchObject([{ taskId: fixture.unrelated.id }]);
      expect((await task(fixture.intended.id))?.status).toBe("to-do");
      expect((await task(fixture.unrelated.id))?.status).toBe("to-do");
    });

    it("links a final task without moving it back to review", async () => {
      await linkIssue(fixture.intended.id);
      await db
        .update(schema.taskTable)
        .set({ status: "done", columnId: fixture.columns.done.id })
        .where(eq(schema.taskTable.id, fixture.intended.id));
      await open();
      expect(await links()).toMatchObject([{ taskId: fixture.intended.id }]);
      expect((await task(fixture.intended.id))?.status).toBe("done");
    });

    it("skips ambiguous candidates across repository integrations for an unscoped delivery", async () => {
      const other = await createFixture(provider, "OTHER");
      await linkIssue(fixture.intended.id);
      await linkIssue(other.intended.id, "61", other.integration.id);
      await openUnscoped();
      await expectUnchanged();
      expect((await task(other.intended.id))?.status).toBe("to-do");
    });

    it("preserves an existing PR association in another integration for an unscoped delivery", async () => {
      const other = await createFixture(provider, "OTHER");
      await linkIssue(fixture.intended.id);
      await linkIssue(
        other.intended.id,
        "109",
        other.integration.id,
        "pull_request",
      );
      await openUnscoped();
      expect(await links()).toMatchObject([{ taskId: other.intended.id }]);
      expect((await task(fixture.intended.id))?.status).toBe("to-do");
      expect((await task(other.intended.id))?.status).toBe("to-do");
    });

    if (provider === "gitea") {
      it("resolves a signed delivery within its integration despite another project's candidate", async () => {
        const other = await createFixture(provider, "OTHER");
        await linkIssue(fixture.intended.id);
        await linkIssue(other.intended.id, "61", other.integration.id);
        await openSigned();
        expect(await links()).toMatchObject([
          {
            taskId: fixture.intended.id,
            integrationId: fixture.integration.id,
          },
        ]);
        expect((await task(fixture.intended.id))?.status).toBe("in-review");
        expect((await task(other.intended.id))?.status).toBe("to-do");
      });

      it("does not let another integration's PR link block a signed delivery", async () => {
        const other = await createFixture(provider, "OTHER");
        await linkIssue(fixture.intended.id);
        await linkIssue(
          other.intended.id,
          "109",
          other.integration.id,
          "pull_request",
        );
        await openSigned();
        expect((await links()).map((link) => link.taskId).sort()).toEqual(
          [fixture.intended.id, other.intended.id].sort(),
        );
        expect((await task(fixture.intended.id))?.status).toBe("in-review");
        expect((await task(other.intended.id))?.status).toBe("to-do");
      });

      it("does not mutate another integration with the signed integration's authority", async () => {
        const other = await createFixture(provider, "OTHER");
        await linkIssue(other.intended.id, "61", other.integration.id);
        await open();
        await expectUnchanged();
        expect((await task(other.intended.id))?.status).toBe("to-do");
      });

      it("rejects a signed integration that does not match the repository", async () => {
        const other = await createFixture(provider, "OTHER", "other-repo");
        await linkIssue(fixture.intended.id);
        await handleGiteaPullRequestOpened(payload(), other.integration.id);
        await expectUnchanged();
        expect((await task(other.intended.id))?.status).toBe("to-do");
      });

      it("rejects an inactive signed integration", async () => {
        await linkIssue(fixture.intended.id);
        await db
          .update(schema.integrationTable)
          .set({ isActive: false })
          .where(eq(schema.integrationTable.id, fixture.integration.id));
        await open();
        await expectUnchanged();
      });
    }
  },
);

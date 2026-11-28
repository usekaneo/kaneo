import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { publishEvent } from "../../apps/api/src/events";
import { writeInboundTaskField } from "../../apps/api/src/plugins/github/services/apply-observed-task-value";
import { handleGiteaIssueClosed } from "../../apps/api/src/plugins/gitea/webhooks/issue-closed";
import { handleGiteaIssueReopened } from "../../apps/api/src/plugins/gitea/webhooks/issue-reopened";
import { handleGiteaPullRequestClosed } from "../../apps/api/src/plugins/gitea/webhooks/pull-request-closed";
import { handleGiteaPullRequestOpened } from "../../apps/api/src/plugins/gitea/webhooks/pull-request-opened";
import { handleGiteaPush } from "../../apps/api/src/plugins/gitea/webhooks/push";
import { handleIssueClosed } from "../../apps/api/src/plugins/github/webhooks/issue-closed";
import { handleIssueOpened } from "../../apps/api/src/plugins/github/webhooks/issue-opened";
import { handleIssueReopened } from "../../apps/api/src/plugins/github/webhooks/issue-reopened";
import { handlePullRequestClosed } from "../../apps/api/src/plugins/github/webhooks/pull-request-closed";
import { handlePullRequestOpened } from "../../apps/api/src/plugins/github/webhooks/pull-request-opened";
import { handlePush } from "../../apps/api/src/plugins/github/webhooks/push";
import { handleGitlabIssueClosed } from "../../apps/api/src/plugins/gitlab/webhooks/issue-closed";
import { handleGitlabIssueReopened } from "../../apps/api/src/plugins/gitlab/webhooks/issue-reopened";
import { handleGitlabMergeRequestClosed } from "../../apps/api/src/plugins/gitlab/webhooks/merge-request-closed";
import { handleGitlabMergeRequestOpened } from "../../apps/api/src/plugins/gitlab/webhooks/merge-request-opened";
import { handleGitlabPush } from "../../apps/api/src/plugins/gitlab/webhooks/push";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { projectAccessApi } from "./helpers/project-access/project-access-api";

vi.mock("../../apps/api/src/events", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../apps/api/src/events")>();
  return {
    ...actual,
    publishEvent: vi.fn(async () => undefined),
  };
});

vi.mock("../../apps/api/src/plugins/github/utils/github-app", () => ({
  getVerifiedInstallationOctokit: async () => ({
    rest: {
      issues: {
        get: async () => ({
          data: {
            state: "open",
            updated_at: new Date().toISOString(),
          },
        }),
      },
    },
  }),
  getGithubApp: async () => null,
}));

vi.mock("../../apps/api/src/plugins/gitea/utils/gitea-api", () => ({
  createGiteaClient: () => ({
    getIssue: async () => ({
      state: "open",
      updated_at: new Date().toISOString(),
    }),
  }),
}));

type Provider = "github" | "gitlab" | "gitea";

async function createCustomColumnFixture(
  provider: Provider,
  initialStatus = "review",
) {
  const owner = await createWorkspaceMember({ role: "owner" });
  const [project] = await db
    .insert(schema.projectTable)
    .values({
      workspaceId: owner.workspace.id,
      name: "Custom Board Project",
      icon: "Folder",
      slug: "KAN",
      lastTaskNumber: 1,
    })
    .returning();

  const columns = await db
    .insert(schema.columnTable)
    .values([
      {
        projectId: project.id,
        name: "Waiting",
        slug: "waiting",
        position: 0,
        isFinal: false,
      },
      {
        projectId: project.id,
        name: "Current",
        slug: "current",
        position: 1,
        isFinal: false,
      },
      {
        projectId: project.id,
        name: "Review",
        slug: "review",
        position: 2,
        isFinal: false,
      },
      {
        projectId: project.id,
        name: "Done",
        slug: "done",
        position: 3,
        isFinal: true,
      },
    ])
    .returning();

  const columnBySlug = new Map(columns.map((c) => [c.slug, c]));
  const startColumn = columnBySlug.get(initialStatus);
  if (!startColumn) throw new Error(`Missing column ${initialStatus}`);

  const [integration] = await db
    .insert(schema.integrationTable)
    .values({
      projectId: project.id,
      type: provider,
      isActive: true,
      config: JSON.stringify({
        baseUrl: "https://git.example",
        accessToken: "test-only",
        repositoryOwner: "owner",
        repositoryName: "repo",
        projectPath: "owner/repo",
        installationId: 10,
        repositoryId: 20,
        verifiedGithubAccountId: "123",
        verifiedByUserId: owner.user.id,
        branchPattern: "{slug}-{number}",
        statusTransitions: {
          onBranchPush: "in-progress",
          onPROpen: "in-review",
          onPRMerge: "done",
        },
      }),
    })
    .returning();

  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      number: 1,
      title: "Tracked task",
      status: startColumn.slug,
      columnId: startColumn.id,
      position: 0,
    })
    .returning();

  return { owner, project, columnBySlug, integration, task };
}

beforeEach(async () => {
  await resetTestDatabase();
  vi.mocked(publishEvent).mockReset();
});

describe("workflow rules set to Don't move (no workflow_rule row)", () => {
  it.each(["github", "gitlab", "gitea"] as const)(
    "%s keeps task column unchanged on push, pr_opened, and pr_merged when no rules exist",
    async (provider) => {
      const { project, integration, task } = await createCustomColumnFixture(
        provider,
        "review",
      );

      if (provider === "github") {
        await handlePush({
          ref: "refs/heads/KAN-1-fix",
          installation: { id: 10 },
          repository: {
            id: 20,
            owner: { login: "owner" },
            name: "repo",
            html_url: "https://git.example/owner/repo",
          },
          commits: [],
        });
        await handlePullRequestOpened({
          action: "opened",
          installation: { id: 10 },
          repository: {
            id: 20,
            owner: { login: "owner" },
            name: "repo",
            html_url: "https://git.example/owner/repo",
          },
          pull_request: {
            number: 7,
            title: "PR",
            html_url: "https://git.example/owner/repo/pull/7",
            state: "open",
            head: { ref: "KAN-1-fix" },
            user: { login: "author" },
          },
        });
        await handlePullRequestClosed({
          action: "closed",
          installation: { id: 10 },
          repository: {
            id: 20,
            owner: { login: "owner" },
            name: "repo",
            html_url: "https://git.example/owner/repo",
          },
          pull_request: {
            number: 7,
            title: "PR",
            html_url: "https://git.example/owner/repo/pull/7",
            state: "closed",
            merged: true,
            merged_at: new Date().toISOString(),
            head: { ref: "KAN-1-fix" },
          },
        });
      } else if (provider === "gitlab") {
        await handleGitlabPush(
          {
            ref: "refs/heads/KAN-1-fix",
            after: "abc",
            project: {
              id: 20,
              name: "repo",
              path_with_namespace: "owner/repo",
              web_url: "https://git.example/owner/repo",
            },
          },
          integration.id,
        );
        await handleGitlabMergeRequestOpened(
          {
            object_attributes: {
              iid: 7,
              title: "PR",
              description: null,
              url: "https://git.example/owner/repo/-/merge_requests/7",
              state: "opened",
              draft: false,
              source_branch: "KAN-1-fix",
            },
            project: {
              id: 20,
              name: "repo",
              path_with_namespace: "owner/repo",
              web_url: "https://git.example/owner/repo",
            },
          },
          integration.id,
        );
        await handleGitlabMergeRequestClosed(
          {
            object_attributes: {
              iid: 7,
              title: "PR",
              url: "https://git.example/owner/repo/-/merge_requests/7",
              state: "merged",
              action: "merge",
              source_branch: "KAN-1-fix",
            },
            project: {
              id: 20,
              name: "repo",
              path_with_namespace: "owner/repo",
              web_url: "https://git.example/owner/repo",
            },
          },
          integration.id,
        );
      } else {
        await handleGiteaPush(
          {
            ref: "refs/heads/KAN-1-fix",
            repository: {
              owner: { login: "owner" },
              name: "repo",
              html_url: "https://git.example/owner/repo",
            },
            commits: [],
          },
          integration.id,
        );
        await handleGiteaPullRequestOpened(
          {
            action: "opened",
            repository: {
              owner: { login: "owner" },
              name: "repo",
              html_url: "https://git.example/owner/repo",
            },
            pull_request: {
              number: 7,
              title: "PR",
              html_url: "https://git.example/owner/repo/pulls/7",
              state: "open",
              head: { ref: "KAN-1-fix" },
            },
          },
          integration.id,
        );
        await handleGiteaPullRequestClosed(
          {
            action: "closed",
            repository: {
              owner: { login: "owner" },
              name: "repo",
              html_url: "https://git.example/owner/repo",
            },
            pull_request: {
              number: 7,
              title: "PR",
              html_url: "https://git.example/owner/repo/pulls/7",
              state: "closed",
              merged: true,
              merged_at: new Date().toISOString(),
              head: { ref: "KAN-1-fix" },
            },
          },
          integration.id,
        );
      }

      const saved = await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      });
      expect(saved?.status).toBe("review");

      const links = await db.query.externalLinkTable.findMany({
        where: and(
          eq(schema.externalLinkTable.taskId, task.id),
          eq(schema.externalLinkTable.integrationId, integration.id),
        ),
      });
      expect(links.map((l) => l.resourceType).sort()).toEqual([
        "branch",
        "pull_request",
      ]);

      const prLink = links.find((l) => l.resourceType === "pull_request");
      const prMetadata = JSON.parse(prLink?.metadata ?? "{}");
      if (provider === "gitlab") {
        expect(prMetadata.state).toBe("merged");
      } else {
        expect(prMetadata).toMatchObject({ state: "closed", merged: true });
      }

      expect(
        vi
          .mocked(publishEvent)
          .mock.calls.filter(([type]) => type === "task.status_changed"),
      ).toEqual([]);
      expect(project.id).toBe(saved?.projectId);
    },
  );

  it.each(["github", "gitlab", "gitea"] as const)(
    "%s keeps task column unchanged on issue_closed and issue_reopened when no rules exist, while updating link metadata",
    async (provider) => {
      const { integration, task } = await createCustomColumnFixture(
        provider,
        "review",
      );

      const [issueLink] = await db
        .insert(schema.externalLinkTable)
        .values({
          taskId: task.id,
          integrationId: integration.id,
          resourceType: "issue",
          externalId: "1",
          url: "https://git.example/owner/repo/issues/1",
          metadata: JSON.stringify({ state: "open" }),
        })
        .returning();

      if (provider === "github") {
        await handleIssueClosed({
          action: "closed",
          installation: { id: 10 },
          issue: {
            number: 1,
            title: "Tracked task",
            html_url: "https://git.example/owner/repo/issues/1",
            state: "closed",
          },
          repository: {
            id: 20,
            owner: { login: "owner" },
            name: "repo",
            full_name: "owner/repo",
          },
        });
      } else if (provider === "gitlab") {
        await handleGitlabIssueClosed(
          {
            object_attributes: {
              iid: 1,
              title: "Tracked task",
              url: "https://git.example/owner/repo/-/issues/1",
              state: "closed",
              action: "close",
            },
            project: {
              id: 20,
              name: "repo",
              path_with_namespace: "owner/repo",
              web_url: "https://git.example/owner/repo",
            },
          },
          integration.id,
        );
      } else {
        await handleGiteaIssueClosed(
          {
            action: "closed",
            issue: {
              number: 1,
              title: "Tracked task",
              html_url: "https://git.example/owner/repo/issues/1",
              state: "closed",
            },
            repository: {
              owner: { login: "owner" },
              name: "repo",
              html_url: "https://git.example/owner/repo",
            },
          },
          integration.id,
        );
      }

      expect(
        (
          await db.query.taskTable.findFirst({
            where: eq(schema.taskTable.id, task.id),
          })
        )?.status,
      ).toBe("review");
      expect(
        JSON.parse(
          (
            await db.query.externalLinkTable.findFirst({
              where: eq(schema.externalLinkTable.id, issueLink.id),
            })
          )?.metadata ?? "{}",
        ).state,
      ).toBe("closed");

      if (provider === "github") {
        await handleIssueReopened({
          action: "reopened",
          installation: { id: 10 },
          issue: {
            number: 1,
            title: "Tracked task",
            html_url: "https://git.example/owner/repo/issues/1",
            state: "open",
          },
          repository: {
            id: 20,
            owner: { login: "owner" },
            name: "repo",
            full_name: "owner/repo",
          },
        });
      } else if (provider === "gitlab") {
        await handleGitlabIssueReopened(
          {
            object_attributes: {
              iid: 1,
              title: "Tracked task",
              url: "https://git.example/owner/repo/-/issues/1",
              state: "opened",
              action: "reopen",
            },
            project: {
              id: 20,
              name: "repo",
              path_with_namespace: "owner/repo",
              web_url: "https://git.example/owner/repo",
            },
          },
          integration.id,
        );
      } else {
        await handleGiteaIssueReopened(
          {
            action: "reopened",
            issue: {
              number: 1,
              title: "Tracked task",
              html_url: "https://git.example/owner/repo/issues/1",
              state: "open",
            },
            repository: {
              owner: { login: "owner" },
              name: "repo",
              html_url: "https://git.example/owner/repo",
            },
          },
          integration.id,
        );
      }

      expect(
        (
          await db.query.taskTable.findFirst({
            where: eq(schema.taskTable.id, task.id),
          })
        )?.status,
      ).toBe("review");
      expect(
        JSON.parse(
          (
            await db.query.externalLinkTable.findFirst({
              where: eq(schema.externalLinkTable.id, issueLink.id),
            })
          )?.metadata ?? "{}",
        ).state,
      ).toBe(provider === "gitlab" ? "opened" : "open");

      expect(
        vi
          .mocked(publishEvent)
          .mock.calls.filter(([type]) => type === "task.status_changed"),
      ).toEqual([]);
    },
  );

  it("stops moving tasks after a workflow rule is deleted (set to Don't move)", async () => {
    const { owner, project, columnBySlug, integration, task } =
      await createCustomColumnFixture("github", "waiting");
    mockAuthenticatedSession(owner.user);

    const putResponse = await projectAccessApi()(
      `/workflow-rule/${project.id}`,
      {
        method: "PUT",
        body: {
          integrationType: "github",
          eventType: "branch_push",
          columnId: columnBySlug.get("current")!.id,
        },
      },
    );
    expect(putResponse.status).toBe(200);
    const createdRule = (await putResponse.json()) as { id: string };

    await handlePush({
      ref: "refs/heads/KAN-1-step-1",
      installation: { id: 10 },
      repository: {
        id: 20,
        owner: { login: "owner" },
        name: "repo",
        html_url: "https://git.example/owner/repo",
      },
      commits: [],
    });
    expect(
      (
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, task.id),
        })
      )?.status,
    ).toBe("current");

    const deleteResponse = await projectAccessApi()(
      `/workflow-rule/${createdRule.id}`,
      { method: "DELETE" },
    );
    expect(deleteResponse.status).toBe(200);

    await db
      .update(schema.taskTable)
      .set({
        status: "review",
        columnId: columnBySlug.get("review")!.id,
      })
      .where(eq(schema.taskTable.id, task.id));

    await handlePush({
      ref: "refs/heads/KAN-1-step-2",
      installation: { id: 10 },
      repository: {
        id: 20,
        owner: { login: "owner" },
        name: "repo",
        html_url: "https://git.example/owner/repo",
      },
      commits: [],
    });
    expect(
      (
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, task.id),
        })
      )?.status,
    ).toBe("review");
    expect(integration.id).toBeDefined();
  });

  it("skips moving the task during observed state adoption when no workflow rule exists", async () => {
    const { integration, task } = await createCustomColumnFixture(
      "github",
      "review",
    );
    const afterCommitEffects: Array<() => Promise<void>> = [];

    await writeInboundTaskField(
      db,
      (effect) => {
        afterCommitEffects.push(effect);
      },
      { taskId: task.id },
      integration,
      "state",
      "closed",
    );

    const saved = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    expect(saved?.status).toBe("review");
    expect(afterCommitEffects).toHaveLength(0);
  });

  it("still assigns an initial column when creating a new task from issue_opened without workflow rules", async () => {
    const { project } = await createCustomColumnFixture("github", "review");

    await handleIssueOpened({
      action: "opened",
      installation: { id: 10 },
      issue: {
        number: 99,
        title: "Newly opened remote issue",
        body: "Details",
        html_url: "https://git.example/owner/repo/issues/99",
        user: { login: "octocat" },
      },
      repository: {
        id: 20,
        owner: { login: "owner" },
        name: "repo",
        full_name: "owner/repo",
      },
    });

    const created = await db.query.taskTable.findFirst({
      where: and(
        eq(schema.taskTable.projectId, project.id),
        eq(schema.taskTable.title, "Newly opened remote issue"),
      ),
    });
    expect(created?.status).toBe("waiting");
  });

  it("moves reopened tasks when an issue_reopened workflow rule is configured and stops once deleted", async () => {
    const { owner, project, columnBySlug, integration, task } =
      await createCustomColumnFixture("github", "done");
    mockAuthenticatedSession(owner.user);

    await db.insert(schema.externalLinkTable).values({
      taskId: task.id,
      integrationId: integration.id,
      resourceType: "issue",
      externalId: "1",
      url: "https://git.example/owner/repo/issues/1",
      metadata: JSON.stringify({ state: "closed" }),
    });

    const putResponse = await projectAccessApi()(
      `/workflow-rule/${project.id}`,
      {
        method: "PUT",
        body: {
          integrationType: "github",
          eventType: "issue_reopened",
          columnId: columnBySlug.get("waiting")!.id,
        },
      },
    );
    expect(putResponse.status).toBe(200);
    const createdRule = (await putResponse.json()) as { id: string };

    await handleIssueReopened({
      action: "reopened",
      installation: { id: 10 },
      issue: {
        number: 1,
        title: "Tracked task",
        html_url: "https://git.example/owner/repo/issues/1",
        state: "open",
      },
      repository: {
        id: 20,
        owner: { login: "owner" },
        name: "repo",
        full_name: "owner/repo",
      },
    });
    expect(
      (
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, task.id),
        })
      )?.status,
    ).toBe("waiting");

    const deleteResponse = await projectAccessApi()(
      `/workflow-rule/${createdRule.id}`,
      { method: "DELETE" },
    );
    expect(deleteResponse.status).toBe(200);

    await db
      .update(schema.taskTable)
      .set({
        status: "done",
        columnId: columnBySlug.get("done")!.id,
      })
      .where(eq(schema.taskTable.id, task.id));

    await handleIssueReopened({
      action: "reopened",
      installation: { id: 10 },
      issue: {
        number: 1,
        title: "Tracked task",
        html_url: "https://git.example/owner/repo/issues/1",
        state: "open",
      },
      repository: {
        id: 20,
        owner: { login: "owner" },
        name: "repo",
        full_name: "owner/repo",
      },
    });
    expect(
      (
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, task.id),
        })
      )?.status,
    ).toBe("done");
  });
});

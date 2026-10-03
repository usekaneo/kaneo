import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type * as GiteaApi from "../../apps/api/src/plugins/gitea/utils/gitea-api";
import type * as Events from "../../apps/api/src/events";
import {
  deferIssueEdit,
  deferTaskSync,
} from "../../apps/api/src/plugins/github/services/defer-issue-edit";
import { replayDeferredIssueEdits } from "../../apps/api/src/plugins/github/services/deferred-issue-edits";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { handleTaskCommentCreated } from "../../apps/api/src/plugins/gitea/events/task-comment-created";
import { handleTaskCreated } from "../../apps/api/src/plugins/gitea/events/task-created";
import { handleTaskStatusChanged } from "../../apps/api/src/plugins/gitea/events/task-status-changed";
import { handleTaskTitleChanged } from "../../apps/api/src/plugins/gitea/events/task-title-changed";
import { GiteaApiError } from "../../apps/api/src/plugins/gitea/utils/gitea-api";
import {
  removeLabelFromGitea,
  syncLabelToGitea,
} from "../../apps/api/src/plugins/gitea/utils/sync-label-to-gitea";
import { handleGiteaIssueCommentCreated } from "../../apps/api/src/plugins/gitea/webhooks/issue-comment-created";
import { handleGiteaIssueLabeled } from "../../apps/api/src/plugins/gitea/webhooks/issue-labeled";
import { handleGiteaIssueOpened } from "../../apps/api/src/plugins/gitea/webhooks/issue-opened";
import { handleGiteaPullRequestOpened } from "../../apps/api/src/plugins/gitea/webhooks/pull-request-opened";
import { handleGiteaPush } from "../../apps/api/src/plugins/gitea/webhooks/push";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const remote = vi.hoisted(() => ({
  verifyGiteaToken: vi.fn(),
  getRepo: vi.fn(),
  getIssue: vi.fn(),
  listIssues: vi.fn(),
  listPullRequests: vi.fn(),
  listIssueComments: vi.fn(),
  listLabels: vi.fn(),
  createIssue: vi.fn(),
  updateIssue: vi.fn(),
  createIssueComment: vi.fn(),
  createLabel: vi.fn(),
  addLabelsToIssue: vi.fn(),
  removeLabelFromIssue: vi.fn(),
}));
vi.mock(
  "../../apps/api/src/plugins/gitea/utils/gitea-api",
  async (original) => ({
    ...(await original<typeof GiteaApi>()),
    verifyGiteaToken: remote.verifyGiteaToken,
    createGiteaClient: () => remote,
  }),
);
vi.mock("../../apps/api/src/events", async (original) => ({
  ...(await original<typeof Events>()),
  publishEvent: vi.fn(async () => undefined),
}));

const repository = {
  owner: { login: "owner" },
  name: "repo",
  html_url: "https://gitea.example/owner/repo",
};
const issue = {
  number: 42,
  title: "Remote issue",
  body: "Remote description",
  html_url: `${repository.html_url}/issues/42`,
  state: "open",
  labels: [{ id: 7, name: "bug", color: "123456" }],
  user: { login: "author" },
};
type Mode = "sync" | "ingest-only" | "off";

beforeEach(async () => {
  await resetTestDatabase();
  vi.resetAllMocks();
  remote.verifyGiteaToken.mockResolvedValue({ login: "owner" });
  remote.getRepo.mockResolvedValue({
    ...repository,
    private: true,
    permissions: { pull: true, push: false, admin: false },
  });
  remote.getIssue.mockResolvedValue(issue);
  remote.listLabels.mockResolvedValue([]);
  remote.listIssues.mockResolvedValue([]);
  remote.listPullRequests.mockResolvedValue([]);
  remote.listIssueComments.mockResolvedValue([]);
  remote.createIssue.mockResolvedValue(issue);
  remote.updateIssue.mockResolvedValue({
    ...issue,
    updated_at: "2026-10-01T00:00:01Z",
  });
  remote.createLabel.mockResolvedValue({
    id: 8,
    name: "local",
    color: "123456",
  });
});

async function fixture(mode?: Mode) {
  const member = await createWorkspaceMember({ role: "owner" });
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
    slug: "KAN",
  });
  const config = {
    baseUrl: "https://gitea.example",
    accessToken: "test-only-token",
    repositoryOwner: "owner",
    repositoryName: "repo",
    webhookSecret: "test-only-secret",
    branchPattern: "{slug}-{number}",
    statusTransitions: { onBranchPush: "in-progress", onPROpen: "in-review" },
    ...(mode === undefined ? {} : { issueSyncMode: mode }),
  };
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({
      projectId: project.id,
      type: "gitea",
      isActive: true,
      config: JSON.stringify(config),
    })
    .returning();
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  const request = (
    method: string,
    body?: Record<string, unknown>,
    endpoint = `project/${project.id}`,
  ) =>
    app.request(`/api/gitea-integration/${endpoint}`, {
      method,
      ...(body
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
  return {
    ...member,
    project,
    integration,
    config,
    request,
    context: { integrationId: integration.id, projectId: project.id, config },
  };
}
async function linkedTask(f: {
  project: { id: string };
  integration: { id: string };
}) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: f.project.id,
      number: 1,
      title: "Local title",
      status: "to-do",
    })
    .returning();
  await db.insert(schema.externalLinkTable).values({
    taskId: task.id,
    integrationId: f.integration.id,
    resourceType: "issue",
    externalId: "42",
    url: issue.html_url,
  });
  return task;
}
function expectNoRemoteWrites() {
  for (const method of [
    remote.createIssue,
    remote.updateIssue,
    remote.createIssueComment,
    remote.createLabel,
    remote.addLabelsToIssue,
    remote.removeLabelFromIssue,
  ]) {
    expect(method).not.toHaveBeenCalled();
  }
}
function allowRepositoryWrites() {
  remote.getRepo.mockResolvedValue({
    ...repository,
    private: true,
    permissions: { pull: true, push: true, admin: false },
  });
}

describe("Gitea issue synchronization modes", () => {
  it("ingests issues, comments and labels without backlink or label writes", async () => {
    const f = await fixture("ingest-only");
    await handleGiteaIssueOpened(
      { action: "opened", issue, repository },
      f.integration.id,
    );
    const task = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.projectId, f.project.id),
    });
    expect(task).toMatchObject({
      title: issue.title,
      description: issue.body,
      priority: "low",
    });
    expect(
      await db.query.externalLinkTable.findFirst({
        where: eq(schema.externalLinkTable.taskId, task!.id),
      }),
    ).toMatchObject({ externalId: "42", resourceType: "issue" });
    await handleGiteaIssueCommentCreated(
      {
        action: "created",
        issue,
        repository,
        comment: {
          id: 5,
          body: "Remote comment",
          html_url: `${issue.html_url}#issuecomment-5`,
          user: { login: "author", avatar_url: "" },
          created_at: "2026-10-01T00:00:00Z",
        },
      },
      f.integration.id,
    );
    await handleGiteaIssueLabeled(
      { action: "label_updated", issue, repository },
      f.integration.id,
    );
    expect(
      await db.query.activityTable.findFirst({
        where: eq(schema.activityTable.taskId, task!.id),
      }),
    ).toMatchObject({
      type: "comment",
      content: "Remote comment",
      externalSource: "gitea",
    });
    expect(
      await db.query.labelTable.findMany({
        where: eq(schema.labelTable.taskId, task!.id),
      }),
    ).toEqual([expect.objectContaining({ name: "bug", color: "#123456" })]);
    expectNoRemoteWrites();
  });

  it("keeps legacy integrations in sync, including inbound backlinks and outbound issue creation", async () => {
    const f = await fixture();
    expect(await (await f.request("GET")).json()).toMatchObject({
      issueSyncMode: "sync",
    });
    await handleGiteaIssueOpened(
      { action: "opened", issue, repository },
      f.integration.id,
    );
    expect(remote.createIssueComment).toHaveBeenCalledWith(
      "owner",
      "repo",
      42,
      expect.stringContaining("KAN-"),
    );
    remote.createIssue.mockResolvedValueOnce({
      ...issue,
      number: 43,
      html_url: `${repository.html_url}/issues/43`,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: f.project.id,
        number: 2,
        title: "Local card",
        status: "to-do",
      })
      .returning();
    await handleTaskCreated(
      {
        taskId: task.id,
        projectId: f.project.id,
        userId: f.user.id,
        title: task.title,
        description: null,
        priority: "low",
        status: task.status,
        number: task.number,
      },
      f.context,
    );
    expect(remote.createIssue).toHaveBeenCalledWith(
      "owner",
      "repo",
      expect.objectContaining({ title: task.title }),
    );
    expect(
      await db.query.externalLinkTable.findFirst({
        where: eq(schema.externalLinkTable.taskId, task.id),
      }),
    ).toMatchObject({ resourceType: "issue", externalId: "43" });
    expect(remote.addLabelsToIssue).toHaveBeenCalled();
  });

  it("continues outbound comments and direct label assignment and removal in sync mode", async () => {
    const f = await fixture("sync");
    const task = await linkedTask(f);
    await handleTaskCommentCreated(
      {
        taskId: task.id,
        projectId: f.project.id,
        userId: f.user.id,
        comment: "Local comment",
      },
      f.context,
    );
    expect(remote.createIssueComment).toHaveBeenCalledWith(
      "owner",
      "repo",
      42,
      expect.stringContaining("Local comment"),
    );
    await syncLabelToGitea(task.id, "local", "#123456");
    expect(remote.createLabel).toHaveBeenCalledWith(
      "owner",
      "repo",
      "local",
      "123456",
    );
    expect(remote.addLabelsToIssue).toHaveBeenCalledWith(
      "owner",
      "repo",
      42,
      [8],
    );
    remote.listLabels.mockResolvedValueOnce([
      { id: 8, name: "local", color: "123456" },
    ]);
    await removeLabelFromGitea(task.id, "local");
    expect(remote.removeLabelFromIssue).toHaveBeenCalledWith(
      "owner",
      "repo",
      42,
      8,
    );
  });

  it("keeps full integration deactivation as the master control", async () => {
    const f = await fixture("sync");
    const task = await linkedTask(f);
    await db
      .update(schema.integrationTable)
      .set({ isActive: false })
      .where(eq(schema.integrationTable.id, f.integration.id));
    await handleGiteaIssueOpened(
      { action: "opened", issue: { ...issue, number: 43 }, repository },
      f.integration.id,
    );
    await syncLabelToGitea(task.id, "local", "#123456");
    await removeLabelFromGitea(task.id, "local");
    expect(
      await db.query.taskTable.findMany({
        where: eq(schema.taskTable.projectId, f.project.id),
      }),
    ).toEqual([expect.objectContaining({ id: task.id })]);
    expectNoRemoteWrites();
  });

  it.each(["ingest-only", "off"] as const)(
    "retires pending writes immediately when switching through %s",
    async (issueSyncMode) => {
      const f = await fixture("sync");
      allowRepositoryWrites();
      const task = await linkedTask(f);
      const link = await db.query.externalLinkTable.findFirst({
        where: eq(schema.externalLinkTable.taskId, task.id),
      });
      await deferTaskSync(link!, f.integration, [
        "title",
        "description",
        "state",
      ]);
      const queued = await db.query.externalLinkTable.findFirst({
        where: eq(schema.externalLinkTable.id, link!.id),
      });
      expect(JSON.parse(queued!.metadata!).deferredIssueEdit).toBeDefined();
      expect((await f.request("PATCH", { issueSyncMode })).status).toBe(200);
      expect((await f.request("PATCH", { issueSyncMode: "sync" })).status).toBe(
        200,
      );
      const saved = await db.query.externalLinkTable.findFirst({
        where: eq(schema.externalLinkTable.id, link!.id),
      });
      expect(saved).toMatchObject({ taskId: task.id, externalId: "42" });
      expect(JSON.parse(saved!.metadata!).deferredIssueEdit).toBeUndefined();
      expectNoRemoteWrites();
    },
  );

  it("preserves inbound work while discarding repairs across rapid ingest-only and sync toggles", async () => {
    const f = await fixture("sync");
    allowRepositoryWrites();
    const task = await linkedTask(f);
    const link = await db.query.externalLinkTable.findFirst({
      where: eq(schema.externalLinkTable.taskId, task.id),
    });
    await deferIssueEdit(link!, f.integration, ["title", "description"]);
    await deferTaskSync(link!, f.integration, ["state"]);
    expect(
      (await f.request("PATCH", { issueSyncMode: "ingest-only" })).status,
    ).toBe(200);
    const saved = await db.query.externalLinkTable.findFirst({
      where: eq(schema.externalLinkTable.id, link!.id),
    });
    const queued = JSON.parse(saved!.metadata!).deferredIssueEdit;
    expect(queued.fields).toEqual(["title", "description"]);
    expect(queued.repairFields).toBeUndefined();
    expect((await f.request("PATCH", { issueSyncMode: "sync" })).status).toBe(
      200,
    );
    await replayDeferredIssueEdits();
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      }),
    ).toMatchObject({ title: issue.title, description: issue.body });
    const completed = await db.query.externalLinkTable.findFirst({
      where: eq(schema.externalLinkTable.id, link!.id),
    });
    expect(completed).toMatchObject({ taskId: task.id, externalId: "42" });
    expect(JSON.parse(completed!.metadata!).deferredIssueEdit).toBeUndefined();
    expectNoRemoteWrites();
  });

  it.each(["ingest-only", "off"] as const)(
    "suppresses every local issue mutation in %s without removing links",
    async (mode) => {
      const f = await fixture(mode);
      const task = await linkedTask(f);
      const [unlinked] = await db
        .insert(schema.taskTable)
        .values({ projectId: f.project.id, number: 2, title: "Unlinked card" })
        .returning();
      await handleTaskCreated(
        {
          taskId: unlinked.id,
          projectId: f.project.id,
          userId: f.user.id,
          title: unlinked.title,
          description: null,
          priority: "low",
          status: unlinked.status,
          number: unlinked.number,
        },
        f.context,
      );
      await handleTaskTitleChanged(
        {
          taskId: task.id,
          projectId: f.project.id,
          userId: f.user.id,
          oldTitle: "Previous",
          newTitle: task.title,
        },
        f.context,
      );
      await handleTaskCommentCreated(
        {
          taskId: task.id,
          projectId: f.project.id,
          userId: f.user.id,
          comment: "Local comment",
        },
        f.context,
      );
      await syncLabelToGitea(task.id, "local", "#123456");
      await removeLabelFromGitea(task.id, "local");
      expectNoRemoteWrites();
      expect(
        await db.query.externalLinkTable.findMany({
          where: eq(schema.externalLinkTable.taskId, task.id),
        }),
      ).toEqual([
        expect.objectContaining({ resourceType: "issue", externalId: "42" }),
      ]);
      expect(
        await db.query.externalLinkTable.findMany({
          where: eq(schema.externalLinkTable.taskId, unlinked.id),
        }),
      ).toEqual([]);
    },
  );

  it("ignores off-mode issue, comment and label deliveries without changing existing data", async () => {
    const f = await fixture("off");
    const task = await linkedTask(f);
    await handleGiteaIssueOpened(
      { action: "opened", issue: { ...issue, number: 43 }, repository },
      f.integration.id,
    );
    await handleGiteaIssueCommentCreated(
      {
        action: "created",
        issue,
        repository,
        comment: {
          id: 5,
          body: "Ignored comment",
          html_url: `${issue.html_url}#issuecomment-5`,
          user: { login: "author", avatar_url: "" },
          created_at: "2026-10-01T00:00:00Z",
        },
      },
      f.integration.id,
    );
    await handleGiteaIssueLabeled(
      {
        action: "label_updated",
        issue: { ...issue, labels: [{ name: "status:done" }, { name: "bug" }] },
        repository,
      },
      f.integration.id,
    );
    expect(
      await db.query.taskTable.findMany({
        where: eq(schema.taskTable.projectId, f.project.id),
      }),
    ).toEqual([
      expect.objectContaining({
        id: task.id,
        title: "Local title",
        status: "to-do",
      }),
    ]);
    expect(
      await db.query.activityTable.findMany({
        where: eq(schema.activityTable.taskId, task.id),
      }),
    ).toEqual([]);
    expect(
      await db.query.labelTable.findMany({
        where: eq(schema.labelTable.taskId, task.id),
      }),
    ).toEqual([]);
    expectNoRemoteWrites();
  });

  it("keeps branch and PR linking and status automation while issue sync is off", async () => {
    const f = await fixture("off");
    const task = await linkedTask(f);
    await handleGiteaPush(
      { ref: "refs/heads/KAN-1", after: "abc", repository },
      f.integration.id,
    );
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      }),
    ).toMatchObject({ status: "in-progress" });
    await handleTaskStatusChanged(
      {
        taskId: task.id,
        projectId: f.project.id,
        userId: null,
        title: task.title,
        oldStatus: "to-do",
        newStatus: "in-progress",
      },
      f.context,
    );
    await handleGiteaPullRequestOpened(
      {
        action: "opened",
        repository,
        pull_request: {
          number: 9,
          title: "Change",
          body: null,
          html_url: `${repository.html_url}/pull/9`,
          state: "open",
          head: { ref: "KAN-1" },
          user: { login: "author" },
        },
      },
      f.integration.id,
    );
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      }),
    ).toMatchObject({ status: "in-review" });
    await handleTaskStatusChanged(
      {
        taskId: task.id,
        projectId: f.project.id,
        userId: null,
        title: task.title,
        oldStatus: "in-progress",
        newStatus: "in-review",
      },
      f.context,
    );
    const links = await db.query.externalLinkTable.findMany({
      where: eq(schema.externalLinkTable.taskId, task.id),
    });
    expect(links.map((link) => link.resourceType).sort()).toEqual([
      "branch",
      "issue",
      "pull_request",
    ]);
    expectNoRemoteWrites();
  });

  it("rejects manual import in off mode before fetching or altering tasks", async () => {
    const f = await fixture("off");
    const task = await linkedTask(f);
    const response = await f.request(
      "POST",
      { projectId: f.project.id },
      "import-issues",
    );
    expect(response.status).toBe(400);
    expect(await response.text()).toMatch(/disabled|off/i);
    expect(remote.listIssues).not.toHaveBeenCalled();
    expect(remote.listPullRequests).not.toHaveBeenCalled();
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      }),
    ).toMatchObject({ title: task.title });
  });

  it.each(["ingest-only", "off"] as const)(
    "preserves %s across connection saves, credential rotation and omitted-field patches",
    async (mode) => {
      const f = await fixture(mode);
      const task = await linkedTask(f);
      const link = await db.query.externalLinkTable.findFirst({
        where: eq(schema.externalLinkTable.taskId, task.id),
      });
      if (mode === "ingest-only")
        await deferIssueEdit(link!, f.integration, ["title", "description"]);
      const queuedBefore = await db.query.externalLinkTable.findFirst({
        where: eq(schema.externalLinkTable.id, link!.id),
      });
      for (const accessToken of [undefined, "rotated-test-token"]) {
        const response = await f.request("POST", {
          baseUrl: f.config.baseUrl,
          repositoryOwner: "owner",
          repositoryName: "repo",
          ...(accessToken ? { accessToken } : {}),
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ issueSyncMode: mode });
      }
      expect(
        (await f.request("PATCH", { commentTaskLinkOnGiteaIssue: false }))
          .status,
      ).toBe(200);
      expect(
        await db.query.externalLinkTable.findFirst({
          where: eq(schema.externalLinkTable.id, link!.id),
        }),
      ).toEqual(queuedBefore);
      const saved = await db.query.integrationTable.findFirst({
        where: eq(schema.integrationTable.id, f.integration.id),
      });
      expect(JSON.parse(saved!.config)).toMatchObject({
        issueSyncMode: mode,
        accessToken: "rotated-test-token",
      });
    },
  );

  it("changes only the mode without exporting or deleting existing links", async () => {
    const f = await fixture("off");
    allowRepositoryWrites();
    const task = await linkedTask(f);
    const before = await db.query.externalLinkTable.findMany({
      where: eq(schema.externalLinkTable.taskId, task.id),
    });
    expect((await f.request("PATCH", { issueSyncMode: "sync" })).status).toBe(
      200,
    );
    expect(await (await f.request("GET")).json()).toMatchObject({
      issueSyncMode: "sync",
    });
    expect(
      await db.query.externalLinkTable.findMany({
        where: eq(schema.externalLinkTable.taskId, task.id),
      }),
    ).toEqual(before);
    expectNoRemoteWrites();
    expect(remote.listIssues).not.toHaveBeenCalled();
  });

  it.each(["POST", "PATCH"])(
    "refuses unknown modes on %s before changing stored settings",
    async (method) => {
      const f = await fixture("ingest-only");
      const response = await f.request(method, {
        baseUrl: f.config.baseUrl,
        accessToken: "test-only-token",
        repositoryOwner: "owner",
        repositoryName: "repo",
        issueSyncMode: "outbound-only",
      });
      expect(response.status).toBe(400);
      expect(remote.verifyGiteaToken).not.toHaveBeenCalled();
      expect(await (await f.request("GET")).json()).toMatchObject({
        issueSyncMode: "ingest-only",
      });
    },
  );

  it("requires repository access but not issue write permission for read-only modes", async () => {
    const f = await fixture("ingest-only");
    const body = {
      projectId: f.project.id,
      baseUrl: f.config.baseUrl,
      repositoryOwner: "owner",
      repositoryName: "repo",
    };
    for (const mode of ["sync", "ingest-only", "off"] as const) {
      const response = await f.request(
        "POST",
        { ...body, issueSyncMode: mode },
        "verify",
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        repositoryExists: true,
        hasRequiredPermissions: mode !== "sync",
      });
    }
    const savedMode = await f.request("POST", body, "verify");
    expect(savedMode.status).toBe(200);
    expect(await savedMode.json()).toMatchObject({
      repositoryExists: true,
      hasRequiredPermissions: true,
    });
    remote.getRepo.mockRejectedValueOnce(
      new GiteaApiError("Not found", 404, "HTTP_ERROR"),
    );
    const denied = await f.request(
      "POST",
      { ...body, issueSyncMode: "off" },
      "verify",
    );
    expect(await denied.json()).toMatchObject({
      repositoryExists: false,
      hasRequiredPermissions: false,
    });
  });

  it("reconnects with explicit credentials and mode despite malformed saved config", async () => {
    const f = await fixture("ingest-only");
    await db
      .update(schema.integrationTable)
      .set({ config: "null" })
      .where(eq(schema.integrationTable.id, f.integration.id));
    const response = await f.request("POST", {
      baseUrl: f.config.baseUrl,
      accessToken: "reconnected-token",
      repositoryOwner: "owner",
      repositoryName: "repo",
      issueSyncMode: "ingest-only",
    });
    expect(response.status).toBe(200);
    const saved = await db.query.integrationTable.findFirst({
      where: eq(schema.integrationTable.id, f.integration.id),
    });
    expect(JSON.parse(saved!.config)).toMatchObject({
      accessToken: "reconnected-token",
      issueSyncMode: "ingest-only",
      repositoryOwner: "owner",
      repositoryName: "repo",
    });
  });

  it.each(["PATCH", "POST"])(
    "refuses read-only sync enabling on %s without altering queued inbound work",
    async (method) => {
      const f = await fixture("ingest-only");
      const task = await linkedTask(f);
      const link = await db.query.externalLinkTable.findFirst({
        where: eq(schema.externalLinkTable.taskId, task.id),
      });
      await deferIssueEdit(link!, f.integration, ["title"]);
      const before = await db.query.externalLinkTable.findFirst({
        where: eq(schema.externalLinkTable.id, link!.id),
      });
      const response = await f.request(method, {
        baseUrl: f.config.baseUrl,
        accessToken: "new-token",
        repositoryOwner: "owner",
        repositoryName: "repo",
        issueSyncMode: "sync",
      });
      expect(response.status).toBe(400);
      expect(
        await db.query.integrationTable.findFirst({
          where: eq(schema.integrationTable.id, f.integration.id),
        }),
      ).toEqual(f.integration);
      expect(
        await db.query.externalLinkTable.findFirst({
          where: eq(schema.externalLinkTable.id, link!.id),
        }),
      ).toEqual(before);
    },
  );

  it("retires inbound work on ingest-only to off without checking write permission", async () => {
    const f = await fixture("ingest-only");
    const task = await linkedTask(f);
    const link = await db.query.externalLinkTable.findFirst({
      where: eq(schema.externalLinkTable.taskId, task.id),
    });
    await deferIssueEdit(link!, f.integration, ["title"]);
    expect((await f.request("PATCH", { issueSyncMode: "off" })).status).toBe(
      200,
    );
    const retired = await db.query.externalLinkTable.findFirst({
      where: eq(schema.externalLinkTable.id, link!.id),
    });
    expect(JSON.parse(retired!.metadata!).deferredIssueEdit).toBeUndefined();
    expect(
      (await f.request("PATCH", { issueSyncMode: "ingest-only" })).status,
    ).toBe(200);
    expect(remote.getRepo).not.toHaveBeenCalled();
  });

  it("rejects a stale permission result rather than overwriting newer credentials", async () => {
    const f = await fixture("off");
    remote.getRepo.mockImplementationOnce(async () => {
      await db
        .update(schema.integrationTable)
        .set({
          config: JSON.stringify({
            ...f.config,
            accessToken: "concurrently-rotated-token",
          }),
          updatedAt: new Date(),
        })
        .where(eq(schema.integrationTable.id, f.integration.id));
      return { ...repository, private: true, permissions: { push: true } };
    });
    expect((await f.request("PATCH", { issueSyncMode: "sync" })).status).toBe(
      409,
    );
    const saved = await db.query.integrationTable.findFirst({
      where: eq(schema.integrationTable.id, f.integration.id),
    });
    expect(JSON.parse(saved!.config)).toMatchObject({
      accessToken: "concurrently-rotated-token",
      issueSyncMode: "off",
    });
  });
});

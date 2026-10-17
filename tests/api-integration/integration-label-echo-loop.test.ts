import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { giteaPlugin } from "../../apps/api/src/plugins/gitea";
import { handleGiteaIssueLabeled } from "../../apps/api/src/plugins/gitea/webhooks/issue-labeled";
import { githubPlugin } from "../../apps/api/src/plugins/github";
import { gitlabPlugin } from "../../apps/api/src/plugins/gitlab";
import { handleGitlabIssueUpdated } from "../../apps/api/src/plugins/gitlab/webhooks/issue-updated";
import { handleIssueLabeled } from "../../apps/api/src/plugins/github/webhooks/issue-labeled";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

type Delivery = {
  action: string;
  label: string;
  labels: string[];
  previous: string[];
};

// The provider mock keeps one issue and queues the webhook each label write
// would trigger, so tests control when and in which order they arrive.
const mocks = vi.hoisted(() => ({
  labels: new Set<string>(),
  deliveries: [] as Delivery[],
}));
const names = [
  "status:to-do",
  "status:in-progress",
  "status:in-review",
  "one",
  "two",
];
function change(action: "labeled" | "unlabeled", name: string) {
  const previous = [...mocks.labels];
  if (action === "labeled") mocks.labels.add(name);
  else mocks.labels.delete(name);
  mocks.deliveries.push({
    action,
    label: name,
    labels: [...mocks.labels],
    previous,
  });
}
const issue = () => ({
  title: "Task",
  body: "",
  state: "open",
  labels: [...mocks.labels].map((name) => ({ name })),
  updated_at: "2026-10-07T04:00:00Z",
});
vi.mock("../../apps/api/src/plugins/github/utils/github-app", () => ({
  getGithubApp: () => ({}),
  getVerifiedInstallationOctokit: async () => ({
    rest: {
      issues: {
        get: async () => ({ data: issue() }),
        getLabel: async () => ({}),
        removeLabel: async ({ name }: { name: string }) => {
          if (mocks.labels.has(name)) change("unlabeled", name);
        },
        addLabels: async ({ labels }: { labels: string[] }) => {
          for (const name of labels)
            if (!mocks.labels.has(name)) change("labeled", name);
        },
      },
    },
  }),
}));
vi.mock("../../apps/api/src/plugins/gitea/utils/gitea-api", () => ({
  createGiteaClient: () => ({
    getIssue: async () => issue(),
    listLabels: async () => names.map((name, id) => ({ name, id: id + 1 })),
    removeLabelFromIssue: async (
      _owner: string,
      _repo: string,
      _number: number,
      id: number,
    ) => {
      if (mocks.labels.has(names[id - 1]!)) change("unlabeled", names[id - 1]!);
    },
    addLabelsToIssue: async (
      _owner: string,
      _repo: string,
      _number: number,
      ids: number[],
    ) => {
      for (const id of ids)
        if (!mocks.labels.has(names[id - 1]!))
          change("labeled", names[id - 1]!);
    },
  }),
}));
vi.mock("../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  createGitlabClient: () => ({
    getIssue: async () => issue(),
    listLabels: async () => names.map((name, id) => ({ name, id: id + 1 })),
    // GitLab applies both lists in one request and sends one webhook.
    updateIssue: async (
      _project: string,
      _number: number,
      body: { add_labels?: string; remove_labels?: string },
    ) => {
      const previous = [...mocks.labels];
      for (const name of body.remove_labels?.split(",") ?? [])
        mocks.labels.delete(name);
      for (const name of body.add_labels?.split(",") ?? [])
        mocks.labels.add(name);
      mocks.deliveries.push({
        action: "update",
        label: "",
        labels: [...mocks.labels],
        previous,
      });
      return issue();
    },
  }),
}));

beforeEach(async () => {
  await resetTestDatabase();
  mocks.labels = new Set(["status:to-do"]);
  mocks.deliveries = [];
});

async function setup(provider: "github" | "gitea" | "gitlab") {
  const { workspace, user } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const column = await db.query.columnTable.findFirst({
    where: (table, { and, eq }) =>
      and(eq(table.projectId, project.id), eq(table.slug, "to-do")),
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      number: 1,
      title: "Task",
      status: "to-do",
      columnId: column!.id,
    })
    .returning();
  const config = {
    baseUrl: "https://git.example",
    accessToken: "fake-test-token",
    repositoryOwner: "team",
    repositoryName: "repo",
    projectPath: "team/repo",
    installationId: 1,
    repositoryId: 2,
    verifiedGithubAccountId: "3",
    verifiedByUserId: user.id,
    commentTaskLinkOnGitHubIssue: false,
    commentTaskLinkOnGiteaIssue: false,
    commentTaskLinkOnGitlabIssue: false,
  };
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({
      projectId: project.id,
      type: provider,
      isActive: true,
      config: JSON.stringify(config),
    })
    .returning();
  await db.insert(schema.externalLinkTable).values({
    taskId: task!.id,
    integrationId: integration!.id,
    resourceType: "issue",
    externalId: "1",
    url: "https://git.example/team/repo/issues/1",
  });
  const plugin =
    provider === "github"
      ? githubPlugin
      : provider === "gitea"
        ? giteaPlugin
        : gitlabPlugin;
  const context = {
    integrationId: integration!.id,
    projectId: project.id,
    config,
  };
  const status = async () =>
    (await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task!.id),
    }))!.status;
  // Mirrors the status_changed subscriber: Kaneo writes its new status back.
  const syncStatus = (oldStatus: string, newStatus: string) =>
    plugin.onTaskStatusChanged!(
      {
        taskId: task!.id,
        projectId: project.id,
        userId: null,
        title: task!.title,
        oldStatus,
        newStatus,
      },
      context,
    );
  const receive = ({ action, label, labels, previous }: Delivery) =>
    provider === "gitlab"
      ? handleGitlabIssueUpdated(
          {
            object_attributes: {
              iid: 1,
              title: "Task",
              description: "",
              state: "opened",
              url: "https://git.example/team/repo/-/issues/1",
            },
            changes: {
              labels: {
                previous: previous.map((title) => ({ title })),
                current: labels.map((title) => ({ title })),
              },
            },
            project: {
              name: "repo",
              path_with_namespace: "team/repo",
              web_url: "https://git.example/team/repo",
            },
          },
          integration!.id,
        )
      : provider === "github"
        ? handleIssueLabeled({
            action,
            installation: { id: 1 },
            repository: { id: 2, owner: { login: "team" }, name: "repo" },
            issue: { number: 1, labels: labels.map((name) => ({ name })) },
            label: { name: label, color: "6B7280" },
          })
        : handleGiteaIssueLabeled(
            {
              action: "label_updated",
              repository: {
                owner: { login: "team" },
                name: "repo",
                html_url: "https://git.example/team/repo",
              },
              issue: { number: 1, labels: labels.map((name) => ({ name })) },
            },
            integration!.id,
          );
  // Deliver queued webhooks and replay the outbound sync after every status
  // change they cause, as the event bus would. Returns the inbound flips.
  const drain = async () => {
    const flips: string[] = [];
    for (let step = 0; step < 40 && mocks.deliveries.length; step++) {
      const before = await status();
      await receive(mocks.deliveries.shift()!);
      const after = await status();
      if (after === before) continue;
      flips.push(after);
      await syncStatus(before, after);
    }
    return flips;
  };
  return { task: task!, workspace, status, syncStatus, drain };
}

it.each(["github", "gitea", "gitlab"] as const)(
  "%s ignores stale label echoes after Kaneo changes the status (#1956)",
  async (provider) => {
    const f = await setup(provider);
    // Two ordinary labels reach the issue first. Their webhooks still carry
    // the old status label when they arrive after the status change below.
    for (const name of ["one", "two"]) {
      await db.insert(schema.labelTable).values({
        workspaceId: f.workspace.id,
        taskId: f.task.id,
        name,
        color: "#6B7280",
      });
      change("labeled", name);
    }
    await db
      .update(schema.taskTable)
      .set({ status: "in-progress", columnId: null })
      .where(eq(schema.taskTable.id, f.task.id));
    await f.syncStatus("to-do", "in-progress");

    expect(await f.drain()).toEqual([]);
    expect(mocks.deliveries).toEqual([]);
    expect(await f.status()).toBe("in-progress");
    expect(
      [...mocks.labels].filter((name) => name.startsWith("status:")),
    ).toEqual(["status:in-progress"]);
  },
);

it.each(["github", "gitea", "gitlab"] as const)(
  "%s ignores an echo that arrives after a newer Kaneo status",
  async (provider) => {
    const f = await setup(provider);
    await db
      .update(schema.taskTable)
      .set({ status: "in-progress" })
      .where(eq(schema.taskTable.id, f.task.id));
    await f.syncStatus("to-do", "in-progress");
    await db
      .update(schema.taskTable)
      .set({ status: "in-review" })
      .where(eq(schema.taskTable.id, f.task.id));
    await f.syncStatus("in-progress", "in-review");

    expect(await f.drain()).toEqual([]);
    expect(await f.status()).toBe("in-review");
  },
);

it.each(["github", "gitea", "gitlab"] as const)(
  "%s still applies a status label changed on the provider",
  async (provider) => {
    const f = await setup(provider);
    change("unlabeled", "status:to-do");
    change("labeled", "status:in-review");

    expect(await f.drain()).toEqual(["in-review"]);
    expect(await f.status()).toBe("in-review");
    expect(
      [...mocks.labels].filter((name) => name.startsWith("status:")),
    ).toEqual(["status:in-review"]);
  },
);

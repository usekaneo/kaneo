import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { giteaPlugin } from "../../apps/api/src/plugins/gitea";
import { handleGiteaIssueLabeled } from "../../apps/api/src/plugins/gitea/webhooks/issue-labeled";
import { githubPlugin } from "../../apps/api/src/plugins/github";
import { handleIssueLabeled } from "../../apps/api/src/plugins/github/webhooks/issue-labeled";
import {
  broadcastTaskStatusChanged,
  registerPlugin,
} from "../../apps/api/src/plugins/registry";
import { replayDeferredLabelFields } from "../../apps/api/src/plugins/sync/replay-deferred-label-fields";
import type { TaskStatusChangedEvent } from "../../apps/api/src/plugins/types";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

type Delivery = { action: string; label: string; labels: string[] };

// The provider mock keeps one issue and queues the webhook each label write
// would trigger, so tests control when and in which order they arrive.
const mocks = vi.hoisted(() => ({
  labels: new Set<string>(),
  deliveries: [] as Delivery[],
  events: [] as Array<{ name: string; data: unknown }>,
  readFailures: [] as unknown[],
}));
vi.mock("../../apps/api/src/events", () => ({
  publishEvent: async (name: string, data: unknown) => {
    mocks.events.push({ name, data });
  },
}));
const names = [
  "status:to-do",
  "status:in-progress",
  "status:in-review",
  "priority:low",
  "priority:high",
  "one",
  "two",
];
function change(action: "labeled" | "unlabeled", name: string) {
  if (action === "labeled") mocks.labels.add(name);
  else mocks.labels.delete(name);
  mocks.deliveries.push({ action, label: name, labels: [...mocks.labels] });
}
const issue = () => {
  const failure = mocks.readFailures.shift();
  if (failure) throw failure;
  return {
    title: "Task",
    body: "",
    state: "open",
    labels: [...mocks.labels].map((name) => ({ name })),
    updated_at: "2026-10-07T04:00:00Z",
  };
};
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

beforeAll(() => {
  registerPlugin(githubPlugin);
  registerPlugin(giteaPlugin);
});
beforeEach(async () => {
  await resetTestDatabase();
  mocks.labels = new Set(["status:to-do"]);
  mocks.deliveries = [];
  mocks.events = [];
  mocks.readFailures = [];
});

async function setup(provider: "github" | "gitea", metadata = {}) {
  const { workspace, user } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const [task] = await db
    .insert(schema.taskTable)
    .values({ projectId: project.id, number: 1, title: "Task" })
    .returning();
  const config = {
    baseUrl: "https://git.example",
    accessToken: "fake-test-token",
    repositoryOwner: "team",
    repositoryName: "repo",
    installationId: 1,
    repositoryId: 2,
    verifiedGithubAccountId: "3",
    verifiedByUserId: user.id,
    commentTaskLinkOnGitHubIssue: false,
    commentTaskLinkOnGiteaIssue: false,
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
  const [link] = await db
    .insert(schema.externalLinkTable)
    .values({
      taskId: task!.id,
      integrationId: integration!.id,
      resourceType: "issue",
      externalId: "1",
      url: "https://git.example/team/repo/issues/1",
      metadata: JSON.stringify(metadata),
    })
    .returning();
  const current = async () =>
    (await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task!.id),
    }))!;
  const status = async () => (await current()).status;
  const metadataOf = async () =>
    JSON.parse(
      (await db.query.externalLinkTable.findFirst({
        where: eq(schema.externalLinkTable.id, link!.id),
      }))!.metadata!,
    );
  // A Kaneo user edit: the API commits it and broadcasts the event.
  const edit = async (newStatus: string) => {
    const oldStatus = await status();
    await db
      .update(schema.taskTable)
      .set({ status: newStatus })
      .where(eq(schema.taskTable.id, task!.id));
    await broadcastTaskStatusChanged({
      taskId: task!.id,
      projectId: project.id,
      userId: user.id,
      title: task!.title,
      oldStatus,
      newStatus,
    });
  };
  const receive = ({ action, label, labels }: Delivery) =>
    provider === "github"
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
  // Deliver queued webhooks and pass the status events they publish to the
  // real broadcaster, as the event bus would. Returns the inbound changes.
  const drain = async () => {
    const flips: string[] = [];
    for (let step = 0; step < 40 && mocks.deliveries.length; step++) {
      await receive(mocks.deliveries.shift()!);
      for (const { name, data } of mocks.events.splice(0))
        if (name === "task.status_changed") {
          const event = data as TaskStatusChangedEvent;
          flips.push(event.newStatus);
          await broadcastTaskStatusChanged(event);
        }
    }
    return flips;
  };
  return {
    task: task!,
    link: link!,
    workspace,
    current,
    status,
    metadataOf,
    edit,
    receive,
    drain,
  };
}
const statusLabels = () =>
  [...mocks.labels].filter((name) => name.startsWith("status:"));

it.each(["github", "gitea"] as const)(
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
    await f.edit("in-progress");

    expect(await f.drain()).toEqual([]);
    expect(mocks.deliveries).toEqual([]);
    expect(await f.status()).toBe("in-progress");
    expect(statusLabels()).toEqual(["status:in-progress"]);
  },
);

it.each(["github", "gitea"] as const)(
  "%s ignores an echo that arrives after a newer Kaneo status",
  async (provider) => {
    const f = await setup(provider);
    await f.edit("in-progress");
    await f.edit("in-review");

    expect(await f.drain()).toEqual([]);
    expect(await f.status()).toBe("in-review");
    expect(statusLabels()).toEqual(["status:in-review"]);
  },
);

it.each(["github", "gitea"] as const)(
  "%s still applies a status label changed on the provider",
  async (provider) => {
    const f = await setup(provider);
    change("unlabeled", "status:to-do");
    change("labeled", "status:in-review");

    expect(await f.drain()).toEqual(["in-review"]);
    expect(await f.status()).toBe("in-review");
    expect(statusLabels()).toEqual(["status:in-review"]);
  },
);

it.each(["github", "gitea"] as const)(
  "%s keeps one value when the same conflicting labels are redelivered",
  async (provider) => {
    const f = await setup(provider);
    change("labeled", "status:in-review");
    const delivery = mocks.deliveries.shift()!;
    // No broadcaster: the conflicting labels stay on the issue.
    await f.receive(delivery);
    expect(await f.status()).toBe("in-review");
    await f.receive(delivery);
    expect(await f.status()).toBe("in-review");
  },
);

it.each(["github", "gitea"] as const)(
  "%s leaves status alone when only priority labels change",
  async (provider) => {
    mocks.labels = new Set(["status:to-do", "priority:low"]);
    const f = await setup(provider, {
      syncFieldLabels: ["status:to-do", "priority:low"],
    });
    // A provider close moved the task to done without a status label edit.
    await db
      .update(schema.taskTable)
      .set({ status: "done", priority: "low" })
      .where(eq(schema.taskTable.id, f.task.id));
    change("labeled", "priority:high");
    await f.receive(mocks.deliveries.shift()!);

    expect(await f.current()).toMatchObject({
      status: "done",
      priority: "high",
    });
  },
);

it.each(["github", "gitea"] as const)(
  "%s replays a provider change when the label lease stays busy",
  async (provider) => {
    const f = await setup(provider);
    const lease = `sync-field-labels:${f.link.id}`;
    await db.insert(schema.jobLeaseTable).values({
      name: lease,
      owner: "slow-reader",
      expiresAt: new Date(Date.now() + 60_000),
    });
    change("unlabeled", "status:to-do");
    change("labeled", "status:in-review");
    await f.receive(mocks.deliveries.pop()!);
    expect(await f.status()).toBe("to-do");
    expect((await f.metadataOf()).syncLabelFieldsDeferred).toEqual(
      expect.any(String),
    );

    await db
      .delete(schema.jobLeaseTable)
      .where(eq(schema.jobLeaseTable.name, lease));
    await replayDeferredLabelFields();
    expect(await f.status()).toBe("in-review");
    expect((await f.metadataOf()).syncLabelFieldsDeferred).toBeNull();
  },
  15_000,
);

it.each(["github", "gitea"] as const)(
  "%s retries transient read failures, then defers them",
  async (provider) => {
    const f = await setup(provider);
    const unavailable = Object.assign(new Error("unavailable"), {
      status: 503,
    });
    mocks.readFailures = [unavailable, unavailable];
    change("labeled", "status:in-review");
    await f.receive(mocks.deliveries.shift()!);
    expect(await f.status()).toBe("in-review");
    expect((await f.metadataOf()).syncLabelFieldsDeferred).toBeUndefined();

    mocks.readFailures = [unavailable, unavailable, unavailable];
    change("unlabeled", "status:in-review");
    change("labeled", "status:in-progress");
    await f.receive(mocks.deliveries.pop()!);
    expect(await f.status()).toBe("in-review");
    await replayDeferredLabelFields();
    expect(await f.status()).toBe("in-progress");
  },
);

it("gitea still syncs ordinary labels when the issue cannot be read", async () => {
  const f = await setup("gitea");
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    mocks.readFailures = [Object.assign(new Error("gone"), { status: 404 })];
    change("labeled", "one");
    await f.receive(mocks.deliveries.shift()!);
  } finally {
    errors.mockRestore();
  }
  const labels = await db.query.labelTable.findMany({
    where: eq(schema.labelTable.taskId, f.task.id),
  });
  expect(labels.map((label) => label.name)).toEqual(["one"]);
  // Replaying a permanent failure cannot succeed, so none is queued.
  expect((await f.metadataOf()).syncLabelFieldsDeferred).toBeUndefined();
});

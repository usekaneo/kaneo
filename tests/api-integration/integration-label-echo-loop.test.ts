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
  readGate: undefined as Promise<void> | undefined,
  onRead: undefined as (() => void) | undefined,
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
  mocks.onRead?.();
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
        get: async () => {
          await mocks.readGate;
          return { data: issue() };
        },
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
    getIssue: async () => {
      await mocks.readGate;
      return issue();
    },
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
  mocks.readGate = undefined;
  mocks.onRead = undefined;
});

// Links record the field labels they start with; `{}` is a link from before.
async function setup(
  provider: "github" | "gitea",
  metadata: Record<string, unknown> = { syncFieldLabels: [...mocks.labels] },
) {
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
  "%s defers a transient read failure to replay",
  async (provider) => {
    const f = await setup(provider);
    mocks.readFailures = [
      Object.assign(new Error("unavailable"), { status: 503 }),
    ];
    change("unlabeled", "status:to-do");
    change("labeled", "status:in-review");
    await f.receive(mocks.deliveries.pop()!);
    expect(await f.status()).toBe("to-do");
    await replayDeferredLabelFields();
    expect(await f.status()).toBe("in-review");
  },
);

it.each(["github", "gitea"] as const)(
  "%s replays a deferred change on a resumed link",
  async (provider) => {
    // Resume records the provider's labels as both baselines.
    const f = await setup(provider, {
      syncResumeLabelBaseline: ["status:to-do"],
      syncFieldLabels: ["status:to-do"],
    });
    const lease = `sync-field-labels:${f.link.id}`;
    await db.insert(schema.jobLeaseTable).values({
      name: lease,
      owner: "slow-reader",
      expiresAt: new Date(Date.now() + 60_000),
    });
    change("unlabeled", "status:to-do");
    change("labeled", "status:in-review");
    // The webhook still advances the resume baseline from its snapshot.
    await f.receive(mocks.deliveries.pop()!);
    expect((await f.metadataOf()).syncResumeLabelBaseline).toEqual([
      "status:in-review",
    ]);
    await db
      .delete(schema.jobLeaseTable)
      .where(eq(schema.jobLeaseTable.name, lease));
    await replayDeferredLabelFields();
    expect(await f.status()).toBe("in-review");
  },
  15_000,
);

it("github defers a provider read that outlives the delivery budget", async () => {
  const f = await setup("github");
  let release!: () => void;
  mocks.readGate = new Promise((resolve) => {
    release = resolve;
  });
  change("labeled", "status:in-review");
  const started = Date.now();
  await f.receive(mocks.deliveries.shift()!);
  expect(Date.now() - started).toBeLessThan(9_500);
  expect((await f.metadataOf()).syncLabelFieldsDeferred).toEqual(
    expect.any(String),
  );
  // The slow read still finishes; replay then confirms the same labels.
  release();
  await vi.waitFor(async () => expect(await f.status()).toBe("in-review"));
  await replayDeferredLabelFields();
  expect(await f.status()).toBe("in-review");
  expect((await f.metadataOf()).syncLabelFieldsDeferred).toBeNull();
}, 20_000);

it("github applies only the event's label on links without a record", async () => {
  mocks.labels = new Set(["status:to-do", "priority:low"]);
  const f = await setup("github", {});
  // An imported closed issue: done in Kaneo, status:to-do on GitHub.
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
});

it("github waits for the addition when a link without a record sees a removal first", async () => {
  const f = await setup("github", {});
  change("unlabeled", "status:to-do");
  change("labeled", "status:in-review");
  await f.receive(mocks.deliveries.shift()!);
  expect((await f.metadataOf()).syncFieldLabels).toBeUndefined();
  await f.receive(mocks.deliveries.shift()!);
  expect(await f.status()).toBe("in-review");
});

it("gitea records labels without applying them on links without a record", async () => {
  const f = await setup("gitea", {});
  await db
    .update(schema.taskTable)
    .set({ status: "done" })
    .where(eq(schema.taskTable.id, f.task.id));
  change("labeled", "one");
  await f.receive(mocks.deliveries.shift()!);
  expect(await f.status()).toBe("done");
  expect((await f.metadataOf()).syncFieldLabels).toEqual(["status:to-do"]);

  change("unlabeled", "status:to-do");
  change("labeled", "status:in-review");
  await f.receive(mocks.deliveries.pop()!);
  expect(await f.status()).toBe("in-review");
});

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

it("replay moves past a link that keeps failing at its deadline", async () => {
  const first = await setup("gitea");
  const second = await setup("gitea");
  const [earlier, later] = [first, second].sort((a, b) =>
    a.link.id.localeCompare(b.link.id),
  );
  for (const f of [earlier!, later!])
    await db
      .update(schema.externalLinkTable)
      .set({
        metadata: JSON.stringify({
          syncFieldLabels: ["status:to-do"],
          syncLabelFieldsDeferred: "queued",
        }),
      })
      .where(eq(schema.externalLinkTable.id, f.link.id));
  const token = async (f: typeof earlier) =>
    (await f!.metadataOf()).syncLabelFieldsDeferred;
  vi.useFakeTimers({ toFake: ["Date"] });
  try {
    // Every read fails transiently and runs past the run's deadline.
    mocks.onRead = () => {
      vi.setSystemTime(Date.now() + 46_000);
      throw Object.assign(new Error("unavailable"), { status: 503 });
    };
    await replayDeferredLabelFields();
    expect(await token(earlier)).not.toBe("queued");
    expect(await token(later)).toBe("queued");
    await replayDeferredLabelFields();
    expect(await token(later)).not.toBe("queued");
  } finally {
    vi.useRealTimers();
  }
});

it("github replays the event's label for a deferred link without a record", async () => {
  const f = await setup("github", {});
  const lease = `sync-field-labels:${f.link.id}`;
  await db.insert(schema.jobLeaseTable).values({
    name: lease,
    owner: "slow-reader",
    expiresAt: new Date(Date.now() + 60_000),
  });
  change("labeled", "status:in-review");
  await f.receive(mocks.deliveries.shift()!);
  expect(await f.metadataOf()).toMatchObject({
    syncLabelFieldsAdded: ["status:in-review"],
  });

  await db
    .delete(schema.jobLeaseTable)
    .where(eq(schema.jobLeaseTable.name, lease));
  await replayDeferredLabelFields();
  expect(await f.status()).toBe("in-review");
  // Only the event's label applied; the leftover old label is recorded.
  expect(await f.metadataOf()).toMatchObject({
    syncFieldLabels: ["status:to-do", "status:in-review"],
    syncLabelFieldsAdded: null,
    syncLabelFieldsDeferred: null,
  });
}, 15_000);

it("github shares one delivery budget across integrations", async () => {
  const first = await setup("github");
  const second = await setup("github");
  let release!: () => void;
  mocks.readGate = new Promise((resolve) => {
    release = resolve;
  });
  change("labeled", "status:in-review");
  const started = Date.now();
  await first.receive(mocks.deliveries.shift()!);
  expect(Date.now() - started).toBeLessThan(9_500);
  for (const f of [first, second])
    expect((await f.metadataOf()).syncLabelFieldsDeferred).toEqual(
      expect.any(String),
    );
  // Let the stalled read finish before the next test resets the database.
  release();
  await vi.waitFor(async () => expect(await first.status()).toBe("in-review"));
}, 25_000);

it("github keeps an addition deferred while another read is running", async () => {
  const f = await setup("github", {});
  change("labeled", "status:in-review");
  change("labeled", "priority:high");
  const [status, priority] = mocks.deliveries.splice(0);
  let release!: () => void;
  mocks.readGate = new Promise((resolve) => {
    release = resolve;
  });
  // The status read stalls while holding the field-label lease.
  const stalled = f.receive(status!);
  await vi.waitFor(async () =>
    expect(
      await db.query.jobLeaseTable.findFirst({
        where: eq(schema.jobLeaseTable.name, `sync-field-labels:${f.link.id}`),
      }),
    ).toBeDefined(),
  );
  // The priority event defers behind it and queues its label.
  await f.receive(priority!);
  expect((await f.metadataOf()).syncLabelFieldsAdded).toEqual([
    "priority:high",
  ]);
  release();
  await stalled;
  await replayDeferredLabelFields();
  expect(await f.current()).toMatchObject({
    status: "in-review",
    priority: "high",
  });
}, 20_000);

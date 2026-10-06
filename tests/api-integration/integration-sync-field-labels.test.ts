import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { githubPlugin } from "../../apps/api/src/plugins/github";
import { giteaPlugin } from "../../apps/api/src/plugins/gitea";
import { gitlabPlugin } from "../../apps/api/src/plugins/gitlab";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const mocks = vi.hoisted(() => ({
  labels: new Set<string>(),
  read: vi.fn(),
  write: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
}));
const names = [
  "status:planned",
  "status:in-progress",
  "status:in-review",
  "priority:low",
  "priority:high",
  "priority:urgent",
  "keep",
];
const available = () => names.map((name, id) => ({ name, id: id + 1 }));
const issue = () => ({
  title: "Task",
  body: "",
  state: "open",
  labels: [...mocks.labels],
  updated_at: "2026-10-04T00:00:00Z",
});
vi.mock("../../apps/api/src/plugins/github/utils/github-app", () => ({
  getGithubApp: () => ({}),
  getVerifiedInstallationOctokit: async () => ({
    rest: {
      issues: {
        get: async () => ({ data: await mocks.read() }),
        getLabel: async () => ({}),
        removeLabel: async ({ name }: { name: string }) => {
          mocks.labels.delete(name);
        },
        addLabels: async ({ labels }: { labels: string[] }) => {
          await mocks.write();
          for (const name of labels) mocks.labels.add(name);
        },
      },
    },
  }),
}));
vi.mock("../../apps/api/src/plugins/gitea/utils/gitea-api", () => ({
  createGiteaClient: () => ({
    getIssue: async () => mocks.read(),
    listLabels: async () => {
      await mocks.list();
      return available();
    },
    removeLabelFromIssue: async (
      _owner: string,
      _repo: string,
      _number: number,
      id: number,
    ) => {
      await mocks.remove();
      mocks.labels.delete(names[id - 1]);
    },
    addLabelsToIssue: async (
      _owner: string,
      _repo: string,
      _number: number,
      ids: number[],
    ) => {
      await mocks.write();
      for (const id of ids) mocks.labels.add(names[id - 1]);
    },
  }),
}));
vi.mock("../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  createGitlabClient: () => ({
    getIssue: async () => mocks.read(),
    listLabels: async () => available(),
    updateIssue: async (
      _project: string,
      _number: number,
      body: { add_labels?: string; remove_labels?: string },
    ) => {
      await mocks.write();
      for (const name of body.remove_labels?.split(",") ?? [])
        mocks.labels.delete(name);
      for (const name of body.add_labels?.split(",") ?? [])
        mocks.labels.add(name);
      return issue();
    },
  }),
}));
beforeEach(async () => {
  await resetTestDatabase();
  mocks.write.mockReset().mockResolvedValue(undefined);
  mocks.read.mockReset().mockImplementation(() => issue());
  mocks.list.mockReset().mockResolvedValue(undefined);
  mocks.remove.mockReset().mockResolvedValue(undefined);
  mocks.labels = new Set(["status:planned", "priority:low", "keep"]);
});

it.each(
  (["github", "gitea", "gitlab"] as const).flatMap((provider) =>
    (["status", "priority"] as const).flatMap((field) =>
      (field === "priority"
        ? [
            false,
            true,
            "clear",
            "read-error",
            "initialization",
            "initialization-waits",
            ...(provider === "gitea"
              ? ["initialization-list-error", "initialization-remove-error"]
              : []),
          ]
        : [false, true, "initialization", "initialization-waits"]
      ).map((overlap) => ({ provider, field, overlap })),
    ),
  ),
)(
  "$provider replaces actual $field labels after resume (overlap=$overlap)",
  async ({ provider, field, overlap }) => {
    const { workspace, user } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const clearing = overlap === "clear";
    const initializing =
      typeof overlap === "string" && overlap.startsWith("initialization");
    const initializationFailure =
      overlap === "initialization-list-error" ||
      overlap === "initialization-remove-error";
    const overlapping =
      overlap === true || (initializing && !initializationFailure);
    const first =
      field === "status" ? "in-progress" : clearing ? "no-priority" : "high";
    const last = field === "status" ? "in-review" : "urgent";
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        number: 1,
        title: "Task",
        status: "in-progress",
        priority: field === "priority" ? first : "high",
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
        taskId: task.id,
        integrationId: integration.id,
        resourceType: "issue",
        externalId: "1",
        url: "https://git.example/team/repo/issues/1",
        metadata: JSON.stringify({
          syncResumeLabelBaseline: [...mocks.labels],
          ...(initializing
            ? {
                syncInitializationPending: true,
                syncInitializedState: true,
                syncCreatedText: { title: "Task", description: "" },
              }
            : {}),
        }),
      })
      .returning();
    const plugin =
      provider === "github"
        ? githubPlugin
        : provider === "gitea"
          ? giteaPlugin
          : gitlabPlugin;
    const context = {
      integrationId: integration.id,
      projectId: project.id,
      config,
    };
    const sync = (oldValue: string, value: string) =>
      field === "status"
        ? plugin.onTaskStatusChanged!(
            {
              taskId: task.id,
              projectId: project.id,
              userId: user.id,
              title: task.title,
              oldStatus: oldValue,
              newStatus: value,
            },
            context,
          )
        : plugin.onTaskPriorityChanged!(
            {
              taskId: task.id,
              projectId: project.id,
              userId: user.id,
              title: task.title,
              oldPriority: oldValue,
              newPriority: value,
            },
            context,
          );
    const initialize = () =>
      plugin.onTaskCreated!(
        {
          taskId: task.id,
          projectId: project.id,
          userId: user.id,
          title: task.title,
          description: null,
          status: task.status,
          priority: task.priority,
          number: 1,
        },
        context,
      );
    if (initializationFailure) {
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      (overlap === "initialization-list-error"
        ? mocks.list
        : mocks.remove
      ).mockRejectedValueOnce(new Error("Temporary provider failure"));
      try {
        await initialize();
        const failed = await db.query.externalLinkTable.findFirst({
          where: eq(schema.externalLinkTable.id, link.id),
        });
        expect(JSON.parse(failed!.metadata!)).toMatchObject({
          syncInitializationPending: true,
        });
        expect(JSON.parse(failed!.metadata!).syncInitializedLabels).not.toBe(
          true,
        );
        expect(mocks.write).not.toHaveBeenCalled();
        await initialize();
        const retried = await db.query.externalLinkTable.findFirst({
          where: eq(schema.externalLinkTable.id, link.id),
        });
        expect(JSON.parse(retried!.metadata!)).toMatchObject({
          syncInitializedLabels: true,
          syncInitializationPending: false,
        });
        expect([...mocks.labels].sort()).toEqual([
          "keep",
          "priority:high",
          "status:in-progress",
        ]);
      } finally {
        log.mockRestore();
      }
      return;
    }
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const writing = new Promise<void>((resolve) => {
      started = resolve;
    });
    if (overlapping)
      mocks.write.mockImplementationOnce(async () => {
        started();
        await gate;
      });
    if (overlap === "read-error") {
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      const privateError = Object.assign(
        new Error("fake-private-provider-body"),
        {
          request: {
            headers: { authorization: "fake-private-provider-token" },
          },
        },
      );
      mocks.read.mockRejectedValueOnce(privateError);
      try {
        await sync(field === "status" ? "to-do" : "urgent", first);
        const output = errors.mock.calls
          .flatMap((args) =>
            args.map((value) => String(value) + JSON.stringify(value)),
          )
          .join("\n");
        expect(output).not.toContain("fake-private-provider");
        expect(output).toContain(integration.id);
        expect(output).toContain(link.id);
        expect(mocks.write).not.toHaveBeenCalled();
        return;
      } finally {
        errors.mockRestore();
      }
    }
    const initial =
      overlap === "initialization"
        ? initialize()
        : sync(field === "status" ? "to-do" : "urgent", first);
    if (overlapping) {
      await writing;
      // A slow provider request must not hold task or project row locks.
      await db
        .update(schema.taskTable)
        .set({ [field]: last })
        .where(eq(schema.taskTable.id, task.id));
      const later =
        overlap === "initialization-waits" ? initialize() : sync(first, last);
      release();
      await Promise.all([initial, later]);
    } else await initial;
    const expected = `${field}:${overlapping ? last : first}`;
    expect(
      [...mocks.labels].filter((name) => name.startsWith(`${field}:`)),
    ).toEqual(clearing ? [] : [expected]);
    expect(mocks.labels.has("keep")).toBe(true);
    expect(
      mocks.labels.has(
        field === "status"
          ? initializing
            ? "priority:high"
            : "priority:low"
          : initializing
            ? "status:in-progress"
            : "status:planned",
      ),
    ).toBe(true);
    const saved = await db.query.externalLinkTable.findFirst({
      where: eq(schema.externalLinkTable.id, link.id),
    });
    if (initializing)
      expect(JSON.parse(saved!.metadata!)).toMatchObject({
        syncInitializedLabels: true,
        syncInitializationPending: false,
      });
    if (!clearing)
      expect(JSON.parse(saved!.metadata!).syncResumeLabelBaseline).toContain(
        expected,
      );
    expect(JSON.parse(saved!.metadata!).syncResumeLabelBaseline).not.toContain(
      `${field}:${field === "status" ? "planned" : "low"}`,
    );
  },
);

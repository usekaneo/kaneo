import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import * as eligibility from "../../apps/api/src/plugins/sync/eligibility";
import { updateExternalLink } from "../../apps/api/src/plugins/github/services/link-manager";
import {
  removeLabelFromGitHub,
  syncLabelToGitHub,
} from "../../apps/api/src/plugins/github/utils/sync-label-to-github";
import {
  removeLabelFromGitea,
  syncLabelToGitea,
} from "../../apps/api/src/plugins/gitea/utils/sync-label-to-gitea";
import {
  removeLabelFromGitlab,
  syncLabelToGitlab,
} from "../../apps/api/src/plugins/gitlab/utils/sync-label-to-gitlab";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const mocks = vi.hoisted(() => ({
  createLabel: vi.fn(),
  addLabel: vi.fn(),
  removeLabel: vi.fn(),
}));
vi.mock("../../apps/api/src/plugins/github/utils/github-app", () => ({
  getVerifiedInstallationOctokit: async () => ({
    rest: {
      issues: {
        getLabel: async () => {
          throw new Error("Label does not exist");
        },
        createLabel: mocks.createLabel,
        addLabels: mocks.addLabel,
        removeLabel: mocks.removeLabel,
      },
    },
  }),
}));
vi.mock("../../apps/api/src/plugins/gitea/utils/gitea-api", () => ({
  createGiteaClient: () => ({
    listLabels: async () => [{ id: 7, name: "bug" }],
    getIssue: async () => ({ labels: [] }),
    createLabel: mocks.createLabel,
    addLabelsToIssue: mocks.addLabel,
    removeLabelFromIssue: mocks.removeLabel,
  }),
}));
vi.mock("../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  createGitlabClient: () => ({
    listLabels: async () => [],
    getIssue: async () => ({ labels: [] }),
    createLabel: mocks.createLabel,
    updateIssue: async (
      _project: string,
      _issue: number,
      change: { add_labels?: string },
    ) => (change.add_labels ? mocks.addLabel : mocks.removeLabel)(),
  }),
}));

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  mocks.createLabel.mockResolvedValue({ id: 7, name: "bug" });
  mocks.addLabel.mockResolvedValue(undefined);
  mocks.removeLabel.mockResolvedValue(undefined);
});

it.each(
  (["github", "gitea", "gitlab"] as const).flatMap((provider) =>
    (["add", "remove"] as const).flatMap((action) =>
      (["unchanged", "paused", "rule_changed"] as const).map((change) => ({
        provider,
        action,
        change,
      })),
    ),
  ),
)(
  "$provider custom-label $action rechecks scope at dispatch ($change)",
  async ({ provider, action, change }) => {
    const { user, workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const config = {
      repositoryOwner: "team",
      repositoryName: "repo",
      repositoryId: 1,
      installationId: 2,
      verifiedGithubAccountId: "3",
      verifiedByUserId: user.id,
      baseUrl: "https://git.example",
      projectPath: "team/repo",
      accessToken: "fake-test-token",
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
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Label race",
        number: 1,
        status: "to-do",
      })
      .returning();
    const [link] = await db
      .insert(schema.externalLinkTable)
      .values({
        taskId: task!.id,
        integrationId: integration!.id,
        resourceType: "issue",
        externalId: "12",
        url: "https://git.example/team/repo/issues/12",
      })
      .returning();
    let started!: () => void;
    let release!: () => void;
    const checked = new Promise<void>((resolve) => {
      started = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = eligibility.canSyncTask;
    const guard = vi
      .spyOn(eligibility, "canSyncTask")
      .mockImplementationOnce(async (...args) => {
        const result = await original(...args);
        expect(result).toBe(true);
        started();
        await gate;
        return result;
      });
    const methods = {
      github: { add: syncLabelToGitHub, remove: removeLabelFromGitHub },
      gitea: { add: syncLabelToGitea, remove: removeLabelFromGitea },
      gitlab: { add: syncLabelToGitlab, remove: removeLabelFromGitlab },
    };
    const writing = methods[provider][action](task!.id, "bug", "#123456");
    try {
      await checked;
      if (change === "paused")
        await updateExternalLink(link!.id, {
          metadata: { syncFilterPaused: true },
        });
      if (change === "rule_changed")
        await db
          .update(schema.integrationTable)
          .set({
            config: JSON.stringify({
              ...config,
              syncRules: {
                outgoing: { mode: "labels", match: "any", labels: ["missing"] },
                incoming: { mode: "all" },
              },
            }),
          })
          .where(eq(schema.integrationTable.id, integration!.id));
    } finally {
      release();
      await writing;
      guard.mockRestore();
    }
    expect(mocks.addLabel).toHaveBeenCalledTimes(
      change === "unchanged" && action === "add" ? 1 : 0,
    );
    expect(mocks.removeLabel).toHaveBeenCalledTimes(
      change === "unchanged" && action === "remove" ? 1 : 0,
    );
    if (change !== "unchanged")
      expect(mocks.createLabel).not.toHaveBeenCalled();
  },
);

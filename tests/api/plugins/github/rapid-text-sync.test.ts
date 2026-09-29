import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const m = vi.hoisted(() => ({
  links: vi.fn(),
  update: vi.fn(),
  save: vi.fn(),
}));
vi.mock(
  "../../../../apps/api/src/plugins/github/services/link-manager",
  () => ({ findExternalLinksByTask: m.links, updateExternalLink: m.save }),
);
vi.mock("../../../../apps/api/src/plugins/github/utils/github-app", () => ({
  getGithubApp: () => ({}),
  getVerifiedInstallationOctokit: async () => ({
    rest: { issues: { update: m.update } },
  }),
}));
const { handleTaskTitleChanged } =
  await import("../../../../apps/api/src/plugins/github/events/task-title-changed");
const { handleTaskDescriptionChanged } =
  await import("../../../../apps/api/src/plugins/github/events/task-description-changed");
const context = {
  integrationId: "integration",
  projectId: "project",
  config: {
    repositoryOwner: "owner",
    repositoryName: "repo",
    installationId: 1,
    repositoryId: 2,
    verifiedGithubAccountId: "3",
    verifiedByUserId: "user",
  },
};
beforeEach(() => vi.clearAllMocks());
function link(field: string, source: string, value: string) {
  return {
    id: "link",
    integrationId: "integration",
    taskId: "task",
    resourceType: "issue",
    externalId: "1",
    metadata: JSON.stringify({
      lastSync: {
        [field]: { source, value, timestamp: new Date().toISOString() },
      },
    }),
  };
}
describe("rapid github text edits", () => {
  it("sends a second local title even immediately after the first sync", async () => {
    m.links.mockResolvedValue([link("title", "kaneo", "First title")]);
    await handleTaskTitleChanged(
      {
        taskId: "task",
        projectId: "project",
        userId: "user",
        oldTitle: "First title",
        newTitle: "Second title",
      },
      context,
    );
    expect(m.update).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Second title" }),
    );
  });
  it("sends a different title immediately after an incoming github title", async () => {
    m.links.mockResolvedValue([link("title", "github", "Remote title")]);
    await handleTaskTitleChanged(
      {
        taskId: "task",
        projectId: "project",
        userId: "user",
        oldTitle: "Remote title",
        newTitle: "Local correction",
      },
      context,
    );
    expect(m.update).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Local correction" }),
    );
  });
  it("keeps suppressing an exact incoming echo", async () => {
    m.links.mockResolvedValue([link("title", "github", "Remote title")]);
    await handleTaskTitleChanged(
      {
        taskId: "task",
        projectId: "project",
        userId: "user",
        oldTitle: "Old",
        newTitle: "Remote title",
      },
      context,
    );
    expect(m.update).not.toHaveBeenCalled();
  });
  it("sends a second local description immediately after the first sync", async () => {
    m.links.mockResolvedValue([
      link("description", "kaneo", "First description"),
    ]);
    await handleTaskDescriptionChanged(
      {
        taskId: "task",
        projectId: "project",
        userId: "user",
        oldDescription: "First description",
        newDescription: "Second description",
      },
      context,
    );
    expect(m.update).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("Second description"),
      }),
    );
  });
});

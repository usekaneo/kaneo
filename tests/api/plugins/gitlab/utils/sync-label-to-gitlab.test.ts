import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  removeLabelFromGitlab,
  syncLabelToGitlab,
} from "../../../../../apps/api/src/plugins/gitlab/utils/sync-label-to-gitlab";

const mocks = vi.hoisted(() => ({
  externalLinkFindMany: vi.fn(),
  createGitlabClient: vi.fn(),
  client: {
    listLabels: vi.fn(),
    createLabel: vi.fn(),
    getIssue: vi.fn(),
    updateIssue: vi.fn(),
  },
}));

vi.mock("../../../../../apps/api/src/database", () => ({
  default: {
    query: {
      externalLinkTable: {
        findMany: (...args: unknown[]) => mocks.externalLinkFindMany(...args),
      },
    },
  },
}));

vi.mock("../../../../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  createGitlabClient: (...args: unknown[]) => mocks.createGitlabClient(...args),
}));

function issueLink(isActive: boolean | null) {
  return {
    id: "link-1",
    taskId: "task-1",
    resourceType: "issue",
    externalId: "3",
    integration: {
      id: "integration-1",
      type: "gitlab",
      isActive,
      config: JSON.stringify({
        baseUrl: "https://gitlab.com",
        accessToken: "token",
        projectPath: "acme/web",
      }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createGitlabClient.mockReturnValue(mocks.client);
  mocks.client.listLabels.mockResolvedValue([{ id: 1, name: "bug" }]);
  mocks.client.getIssue.mockResolvedValue({ iid: 3, labels: [] });
  mocks.client.updateIssue.mockResolvedValue({ iid: 3 });
});

describe("GitLab label sync", () => {
  it("adds a label to the issue of an active integration", async () => {
    mocks.externalLinkFindMany.mockResolvedValue([issueLink(true)]);

    await syncLabelToGitlab("task-1", "bug", "#EF4444");

    expect(mocks.client.updateIssue).toHaveBeenCalledWith("acme/web", 3, {
      add_labels: "bug",
    });
  });

  it("leaves GitLab alone when the integration is disabled", async () => {
    mocks.externalLinkFindMany.mockResolvedValue([issueLink(false)]);

    await syncLabelToGitlab("task-1", "bug", "#EF4444");
    await removeLabelFromGitlab("task-1", "bug");

    expect(mocks.createGitlabClient).not.toHaveBeenCalled();
    expect(mocks.client.updateIssue).not.toHaveBeenCalled();
  });
});

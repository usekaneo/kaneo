import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listLabels: vi.fn(),
  createLabel: vi.fn(),
  updateIssue: vi.fn(),
}));

vi.mock("../../../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  createGitlabClient: () => ({
    listLabels: (...args: unknown[]) => mocks.listLabels(...args),
    createLabel: (...args: unknown[]) => mocks.createLabel(...args),
    updateIssue: (...args: unknown[]) => mocks.updateIssue(...args),
  }),
}));

const { addLabelsToIssueGitlab, removeLabelGitlab } = await import(
  "../../../../apps/api/src/plugins/gitlab/utils/labels"
);

const config = {
  baseUrl: "https://gitlab.example.com",
  accessToken: "token",
  repositoryPath: "group/project",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listLabels.mockResolvedValue([{ id: 1, name: "status:to-do" }]);
});

describe("addLabelsToIssueGitlab", () => {
  it("creates a missing label then adds it via a single updateIssue call", async () => {
    await addLabelsToIssueGitlab(config, 5, ["priority:high"]);

    expect(mocks.createLabel).toHaveBeenCalledWith(
      "group/project",
      "priority:high",
      "#F97316",
    );
    expect(mocks.updateIssue).toHaveBeenCalledWith("group/project", 5, {
      add_labels: "priority:high",
    });
  });

  it("does nothing when there are no labels to add", async () => {
    await addLabelsToIssueGitlab(config, 5, []);
    expect(mocks.updateIssue).not.toHaveBeenCalled();
  });
});

describe("removeLabelGitlab", () => {
  it("calls updateIssue with remove_labels", async () => {
    await removeLabelGitlab(config, 5, "status:to-do");
    expect(mocks.updateIssue).toHaveBeenCalledWith("group/project", 5, {
      remove_labels: "status:to-do",
    });
  });
});

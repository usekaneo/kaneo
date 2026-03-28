import { describe, expect, it, vi } from "vitest";
import {
  addLabelsToIssue,
  ensureLabelsExist,
  getLabelColor,
  removeLabel,
} from "../../../../../apps/api/src/plugins/github/utils/labels";

function createOctokitMock() {
  return {
    rest: {
      issues: {
        getLabel: vi.fn(),
        createLabel: vi.fn(),
        addLabels: vi.fn(),
        removeLabel: vi.fn(),
      },
    },
  };
}

describe("github labels helpers", () => {
  it("returns explicit and fallback colors", () => {
    expect(getLabelColor("priority:urgent")).toBe("EF4444");
    expect(getLabelColor("status:done")).toBe("10B981");
    expect(getLabelColor("custom:label")).toBe("6B7280");
  });

  it("creates missing labels only when needed", async () => {
    const octokit = createOctokitMock();
    octokit.rest.issues.getLabel
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("missing"));

    await ensureLabelsExist(octokit as never, "usekaneo", "kaneo", [
      "status:done",
      "priority:high",
    ]);

    expect(octokit.rest.issues.getLabel).toHaveBeenCalledTimes(2);
    expect(octokit.rest.issues.createLabel).toHaveBeenCalledTimes(1);
    expect(octokit.rest.issues.createLabel).toHaveBeenCalledWith({
      owner: "usekaneo",
      repo: "kaneo",
      name: "priority:high",
      color: "F97316",
    });
  });

  it("adds labels after ensuring they exist", async () => {
    const octokit = createOctokitMock();
    octokit.rest.issues.getLabel.mockResolvedValue({});

    await addLabelsToIssue(octokit as never, "usekaneo", "kaneo", 12, [
      "priority:low",
      "status:done",
    ]);

    expect(octokit.rest.issues.getLabel).toHaveBeenCalledTimes(2);
    expect(octokit.rest.issues.createLabel).not.toHaveBeenCalled();
    expect(octokit.rest.issues.addLabels).toHaveBeenCalledWith({
      owner: "usekaneo",
      repo: "kaneo",
      issue_number: 12,
      labels: ["priority:low", "status:done"],
    });
  });

  it("swallows label removal errors", async () => {
    const octokit = createOctokitMock();
    octokit.rest.issues.removeLabel.mockRejectedValue(new Error("gone"));

    await expect(
      removeLabel(octokit as never, "usekaneo", "kaneo", 21, "status:done"),
    ).resolves.toBeUndefined();
  });
});

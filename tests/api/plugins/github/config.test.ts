import { describe, expect, it } from "vitest";
import {
  branchPatterns,
  getDefaultConfig,
  validateGitHubConfig,
} from "../../../../apps/api/src/plugins/github/config";

describe("github config", () => {
  it("exposes the supported branch patterns", () => {
    expect(branchPatterns).toContain("{slug}-{number}");
    expect(branchPatterns).toContain("fix/{number}-{title}");
  });

  it("builds default config values", () => {
    expect(getDefaultConfig("usekaneo", "kaneo", 42)).toEqual({
      repositoryOwner: "usekaneo",
      repositoryName: "kaneo",
      installationId: 42,
      branchPattern: "{slug}-{number}",
      commentTaskLinkOnGitHubIssue: true,
      statusTransitions: {
        onBranchPush: "in-progress",
        onPROpen: "in-review",
        onPRMerge: "done",
      },
    });
  });

  it("validates valid config", async () => {
    await expect(
      validateGitHubConfig({
        repositoryOwner: "usekaneo",
        repositoryName: "kaneo",
        installationId: 42,
        branchPattern: "{slug}-{number}",
      }),
    ).resolves.toEqual({ valid: true });
  });

  it("reports validation errors for invalid config", async () => {
    const result = await validateGitHubConfig({
      repositoryOwner: "usekaneo",
      installationId: "bad",
    });

    expect(result.valid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });
});

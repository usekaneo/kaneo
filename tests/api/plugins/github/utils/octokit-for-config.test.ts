import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getGithubApp: vi.fn(),
  getInstallationIdForRepo: vi.fn(),
  getInstallationOctokit: vi.fn(),
}));

vi.mock("../../../../../apps/api/src/plugins/github/utils/github-app", () => ({
  getGithubApp: (...a: unknown[]) => mocks.getGithubApp(...a),
  getInstallationIdForRepo: (...a: unknown[]) =>
    mocks.getInstallationIdForRepo(...a),
}));

const { getOctokitForConfig, usesAccessToken } = await import(
  "../../../../../apps/api/src/plugins/github/utils/octokit-for-config"
);

const baseConfig = {
  repositoryOwner: "octo",
  repositoryName: "repo",
  installationId: null as number | null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getGithubApp.mockReturnValue({
    getInstallationOctokit: mocks.getInstallationOctokit,
  });
  mocks.getInstallationOctokit.mockResolvedValue({ kind: "installation" });
  mocks.getInstallationIdForRepo.mockResolvedValue(9999);
});

describe("getOctokitForConfig", () => {
  it("bypasses the GitHub App entirely when a PAT is set", async () => {
    const client = await getOctokitForConfig({
      ...baseConfig,
      accessToken: "ghp_secret",
    });

    expect(client).toBeDefined();
    expect(mocks.getGithubApp).not.toHaveBeenCalled();
    expect(mocks.getInstallationIdForRepo).not.toHaveBeenCalled();
    expect(mocks.getInstallationOctokit).not.toHaveBeenCalled();
  });

  it("uses the stored installation id without a token", async () => {
    const client = await getOctokitForConfig({
      ...baseConfig,
      installationId: 42,
    });

    expect(client).toEqual({ kind: "installation" });
    expect(mocks.getInstallationOctokit).toHaveBeenCalledWith(42);
    expect(mocks.getInstallationIdForRepo).not.toHaveBeenCalled();
  });

  it("resolves the installation id from the repo when none is stored", async () => {
    await getOctokitForConfig(baseConfig);

    expect(mocks.getInstallationIdForRepo).toHaveBeenCalledWith("octo", "repo");
    expect(mocks.getInstallationOctokit).toHaveBeenCalledWith(9999);
  });

  it("throws when neither a token nor the App is available", async () => {
    mocks.getGithubApp.mockReturnValue(null);

    await expect(getOctokitForConfig(baseConfig)).rejects.toThrow(
      "GitHub App not configured",
    );
  });
});

describe("usesAccessToken", () => {
  it("reflects whether a token is present", () => {
    expect(usesAccessToken({ accessToken: "x" })).toBe(true);
    expect(usesAccessToken({})).toBe(false);
  });
});

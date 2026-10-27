import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { describeAuth } from "./describe-auth";

const githubStatus = () =>
  describeAuth().providers.find((provider) => provider.id === "github")?.status;

describe("describeAuth", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("doesn't combine the OAuth and legacy GitHub credential pairs", () => {
    vi.stubEnv("GITHUB_OAUTH_CLIENT_ID", "oauth-id");
    vi.stubEnv("GITHUB_OAUTH_CLIENT_SECRET", "");
    vi.stubEnv("GITHUB_CLIENT_ID", "");
    vi.stubEnv("GITHUB_CLIENT_SECRET", "legacy-secret");

    expect(githubStatus()).toBe("warning");
  });

  it("reports GitHub as configured from either complete pair", () => {
    vi.stubEnv("GITHUB_OAUTH_CLIENT_ID", "");
    vi.stubEnv("GITHUB_OAUTH_CLIENT_SECRET", "");
    vi.stubEnv("GITHUB_CLIENT_ID", "legacy-id");
    vi.stubEnv("GITHUB_CLIENT_SECRET", "legacy-secret");

    expect(githubStatus()).toBe("ok");
  });
});

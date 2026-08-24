import { describe, expect, it } from "vitest";
import {
  normalizeGitlabBaseUrl,
  validateGitlabConfig,
} from "../../../apps/api/src/plugins/gitlab/config";

describe("normalizeGitlabBaseUrl", () => {
  it("keeps a plain base URL usable", () => {
    expect(normalizeGitlabBaseUrl("https://gitlab.example.com/")).toBe(
      "https://gitlab.example.com",
    );
    expect(normalizeGitlabBaseUrl("https://gitlab.example.com/sub/")).toBe(
      "https://gitlab.example.com/sub",
    );
  });

  it("rejects a query or fragment that would hijack the request path", () => {
    expect(() => normalizeGitlabBaseUrl("http://example.com/?x=1")).toThrow(
      /query, fragment, or credentials/,
    );
    expect(() => normalizeGitlabBaseUrl("http://example.com/#frag")).toThrow(
      /query, fragment, or credentials/,
    );
  });

  it("rejects embedded credentials and non-http schemes", () => {
    expect(() =>
      normalizeGitlabBaseUrl("http://user:pass@example.com"),
    ).toThrow(/query, fragment, or credentials/);
    expect(() => normalizeGitlabBaseUrl("file:///etc/passwd")).toThrow(
      /must use http or https/,
    );
  });
});

describe("validateGitlabConfig", () => {
  it("accepts a minimal valid config", async () => {
    const result = await validateGitlabConfig({
      baseUrl: "https://gitlab.example.com",
      accessToken: "token",
      repositoryPath: "group/subgroup/project",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a config missing repositoryPath", async () => {
    const result = await validateGitlabConfig({
      baseUrl: "https://gitlab.example.com",
      accessToken: "token",
      repositoryPath: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });
});

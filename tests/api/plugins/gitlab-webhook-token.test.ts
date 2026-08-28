import { describe, expect, it } from "vitest";
import { verifyGitlabWebhookToken } from "../../../apps/api/src/plugins/gitlab/utils/verify-token";
import {
  baseUrlFromProjectWebUrl,
  splitProjectPath,
} from "../../../apps/api/src/plugins/gitlab/utils/webhook-project";

describe("verifyGitlabWebhookToken", () => {
  it("accepts the exact secret", () => {
    expect(verifyGitlabWebhookToken("s3cret", "s3cret")).toBe(true);
    expect(verifyGitlabWebhookToken("s3cret", " s3cret ")).toBe(true);
  });

  it("rejects a wrong, missing, or differently sized token", () => {
    expect(verifyGitlabWebhookToken("s3cret", "wrong!")).toBe(false);
    expect(verifyGitlabWebhookToken("s3cret", undefined)).toBe(false);
    expect(verifyGitlabWebhookToken("s3cret", "s3cretlonger")).toBe(false);
    expect(verifyGitlabWebhookToken("", "s3cret")).toBe(false);
  });
});

describe("baseUrlFromProjectWebUrl", () => {
  it("trims the project path off a gitlab.com URL", () => {
    expect(
      baseUrlFromProjectWebUrl({
        web_url: "https://gitlab.com/acme/my-app",
        path_with_namespace: "acme/my-app",
      }),
    ).toBe("https://gitlab.com");
  });

  it("handles nested groups and an instance served under a path prefix", () => {
    expect(
      baseUrlFromProjectWebUrl({
        web_url: "https://git.example.com/gitlab/acme/platform/my-app",
        path_with_namespace: "acme/platform/my-app",
      }),
    ).toBe("https://git.example.com/gitlab");
  });

  it("returns empty when the payload is unusable", () => {
    expect(baseUrlFromProjectWebUrl({})).toBe("");
    expect(
      baseUrlFromProjectWebUrl({
        web_url: "https://gitlab.com/other/repo",
        path_with_namespace: "acme/my-app",
      }),
    ).toBe("");
  });
});

describe("splitProjectPath", () => {
  it("splits a nested path into namespace and project", () => {
    expect(splitProjectPath("acme/platform/my-app")).toEqual({
      namespace: "acme/platform",
      projectPath: "my-app",
    });
  });

  it("returns null when there is no namespace", () => {
    expect(splitProjectPath("my-app")).toBeNull();
  });
});

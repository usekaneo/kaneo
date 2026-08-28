import { describe, expect, it } from "vitest";
import { normalizeGitlabBaseUrl } from "../../../apps/api/src/plugins/gitlab/config";
import { gitlabFetch } from "../../../apps/api/src/plugins/gitlab/utils/gitlab-api";

describe("normalizeGitlabBaseUrl", () => {
  it("keeps a plain base URL usable", () => {
    expect(normalizeGitlabBaseUrl("https://gitlab.com/")).toBe(
      "https://gitlab.com",
    );
    expect(normalizeGitlabBaseUrl("https://git.example/sub/")).toBe(
      "https://git.example/sub",
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

  it("strips a bare trailing # so the api path cannot be truncated", () => {
    expect(
      normalizeGitlabBaseUrl(
        "http://169.254.169.254/latest/meta-data/iam/security-credentials/role#",
      ),
    ).toBe(
      "http://169.254.169.254/latest/meta-data/iam/security-credentials/role",
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

describe("gitlabFetch destination guard", () => {
  const internalTargets = [
    "http://127.0.0.1:1337",
    "http://localhost:1337",
    "http://169.254.169.254",
    "http://10.0.0.5",
    "http://192.168.1.10",
    "http://172.16.0.1",
    "http://[::1]",
    "http://[::ffff:127.0.0.1]",
  ];

  for (const target of internalTargets) {
    it(`refuses to request ${target}`, async () => {
      await expect(gitlabFetch(target, "token", "/user")).rejects.toThrow(
        /non-routable/,
      );
    });
  }
});

import { describe, expect, it } from "vitest";
import { normalizeGiteaBaseUrl } from "../../../apps/api/src/plugins/gitea/config";
import { giteaFetch } from "../../../apps/api/src/plugins/gitea/utils/gitea-api";

describe("normalizeGiteaBaseUrl", () => {
  it("keeps a plain base URL usable", () => {
    expect(normalizeGiteaBaseUrl("https://gitea.example/")).toBe(
      "https://gitea.example",
    );
    expect(normalizeGiteaBaseUrl("https://gitea.example/sub/")).toBe(
      "https://gitea.example/sub",
    );
  });

  it("rejects a query or fragment that would hijack the request path", () => {
    expect(() => normalizeGiteaBaseUrl("http://example.com/?x=1")).toThrow(
      /query, fragment, or credentials/,
    );
    expect(() => normalizeGiteaBaseUrl("http://example.com/#frag")).toThrow(
      /query, fragment, or credentials/,
    );
  });

  it("strips a bare trailing # so the api path cannot be truncated", () => {
    expect(
      normalizeGiteaBaseUrl(
        "http://169.254.169.254/latest/meta-data/iam/security-credentials/role#",
      ),
    ).toBe(
      "http://169.254.169.254/latest/meta-data/iam/security-credentials/role",
    );
  });

  it("rejects embedded credentials and non-http schemes", () => {
    expect(() => normalizeGiteaBaseUrl("http://user:pass@example.com")).toThrow(
      /query, fragment, or credentials/,
    );
    expect(() => normalizeGiteaBaseUrl("file:///etc/passwd")).toThrow(
      /must use http or https/,
    );
  });
});

describe("giteaFetch destination guard", () => {
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
      await expect(giteaFetch(target, "token", "/user")).rejects.toThrow(
        /non-routable/,
      );
    });
  }
});

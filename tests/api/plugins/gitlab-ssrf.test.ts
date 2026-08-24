import { describe, expect, it } from "vitest";
import { normalizeGitlabBaseUrl } from "../../../apps/api/src/plugins/gitlab/config";
import { gitlabFetch } from "../../../apps/api/src/plugins/gitlab/utils/gitlab-api";

describe("normalizeGitlabBaseUrl (re-verified against the client's own import)", () => {
  it("strips a bare trailing # so the api path cannot be truncated", () => {
    expect(
      normalizeGitlabBaseUrl(
        "http://169.254.169.254/latest/meta-data/iam/security-credentials/role#",
      ),
    ).toBe(
      "http://169.254.169.254/latest/meta-data/iam/security-credentials/role",
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

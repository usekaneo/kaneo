import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { normalizeGitlabBaseUrl } from "../../../apps/api/src/plugins/gitlab/config";
import { gitlabFetch } from "../../../apps/api/src/plugins/gitlab/utils/gitlab-api";
import { assertPrivateDestination } from "../../../apps/api/src/utils/assert-public-destination";

const PRIVATE_OPT_IN = "KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS";
const INSECURE_OPT_IN = "KANEO_ALLOW_INSECURE_GITLAB_URL";

// The runner may inherit this from the environment, which would quietly
// invalidate every default-behaviour assertion below, so it is cleared before
// each test rather than only cleaned up after.
const inherited: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of [PRIVATE_OPT_IN, INSECURE_OPT_IN]) {
    inherited[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of [PRIVATE_OPT_IN, INSECURE_OPT_IN]) {
    if (inherited[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = inherited[key];
    }
  }
});

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
    expect(() => normalizeGitlabBaseUrl("https://example.com/?x=1")).toThrow(
      /query, fragment, or credentials/,
    );
    expect(() => normalizeGitlabBaseUrl("https://example.com/#frag")).toThrow(
      /query, fragment, or credentials/,
    );
  });

  it("strips a bare trailing # so the api path cannot be truncated", () => {
    expect(
      normalizeGitlabBaseUrl(
        "https://169.254.169.254/latest/meta-data/iam/security-credentials/role#",
      ),
    ).toBe(
      "https://169.254.169.254/latest/meta-data/iam/security-credentials/role",
    );
  });

  it("rejects embedded credentials and non-http schemes", () => {
    expect(() =>
      normalizeGitlabBaseUrl("https://user:pass@example.com"),
    ).toThrow(/query, fragment, or credentials/);
    expect(() => normalizeGitlabBaseUrl("file:///etc/passwd")).toThrow(
      /must use http or https/,
    );
  });

  it("refuses plain http, which would put the access token on the wire", () => {
    expect(() => normalizeGitlabBaseUrl("http://gitlab.example.com")).toThrow(
      /must use https/,
    );
  });

  it("does not treat the webhook-destination flag as consent to send the token in the clear", () => {
    // Reaching an internal host and sending credentials across it unencrypted
    // are separate decisions, so the destination flag must not imply the other.
    process.env[PRIVATE_OPT_IN] = "true";

    expect(() => normalizeGitlabBaseUrl("http://gitlab.internal")).toThrow(
      /must use https/,
    );
  });

  it("allows http once the operator has explicitly accepted it", () => {
    process.env[INSECURE_OPT_IN] = "true";

    expect(normalizeGitlabBaseUrl("http://gitlab.internal/")).toBe(
      "http://gitlab.internal",
    );
  });
});

describe("gitlabFetch destination guard", () => {
  const internalTargets = [
    "https://127.0.0.1:1337",
    "https://localhost:1337",
    "https://169.254.169.254",
    "https://10.0.0.5",
    "https://192.168.1.10",
    "https://172.16.0.1",
    "https://[::1]",
    "https://[::ffff:127.0.0.1]",
  ];

  for (const target of internalTargets) {
    it(`refuses to request ${target}`, async () => {
      await expect(gitlabFetch(target, "token", "/user")).rejects.toThrow(
        /non-routable/,
      );
    });
  }

  it("rejects an http target before the token can be sent", async () => {
    await expect(
      gitlabFetch("http://gitlab.example.com", "token", "/user"),
    ).rejects.toThrow(/must use https/);
  });

  it("still refuses http to a public host once http has been accepted", async () => {
    // Accepting cleartext for a private instance must not become a way to send
    // the token to a public address. A literal IP keeps this off the network.
    process.env[INSECURE_OPT_IN] = "true";

    await expect(
      gitlabFetch("http://8.8.8.8", "token", "/user"),
    ).rejects.toThrow(/public address, so it must use https/);
  });
});

describe("assertPrivateDestination", () => {
  it("accepts a private address, which is the only place http may go", async () => {
    await expect(
      assertPrivateDestination("http://10.0.0.5:8080", "GitLab"),
    ).resolves.toBeUndefined();
  });

  it("rejects a public address", async () => {
    await expect(
      assertPrivateDestination("http://8.8.8.8", "GitLab"),
    ).rejects.toThrow(/public address/);
  });
});

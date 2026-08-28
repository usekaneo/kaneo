import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { normalizeGitlabBaseUrl } from "../../../apps/api/src/plugins/gitlab/config";
import { gitlabFetch } from "../../../apps/api/src/plugins/gitlab/utils/gitlab-api";
import { assertPrivateDestination } from "../../../apps/api/src/utils/assert-public-destination";

const PRIVATE_OPT_IN = "KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS";

// The runner may inherit this from the environment, which would quietly
// invalidate every default-behaviour assertion below, so it is cleared before
// each test rather than only cleaned up after.
let inheritedOptIn: string | undefined;

beforeEach(() => {
  inheritedOptIn = process.env[PRIVATE_OPT_IN];
  delete process.env[PRIVATE_OPT_IN];
});

afterEach(() => {
  if (inheritedOptIn === undefined) {
    delete process.env[PRIVATE_OPT_IN];
  } else {
    process.env[PRIVATE_OPT_IN] = inheritedOptIn;
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

  it("allows http once the operator has opted into private destinations", () => {
    // A self-hosted instance on a trusted network is the one case where plain
    // http is a deliberate choice, and it already needs this opt-in to be
    // reachable at all.
    process.env[PRIVATE_OPT_IN] = "true";

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

  it("still refuses http to a public host when private destinations are allowed", async () => {
    // The opt-in switches the public check off rather than narrowing it to
    // private hosts, so it must not become a way to send the token in the
    // clear to a public address. A literal IP keeps this off the network.
    process.env[PRIVATE_OPT_IN] = "true";

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

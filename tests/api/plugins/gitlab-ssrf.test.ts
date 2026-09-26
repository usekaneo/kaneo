import { afterEach, describe, expect, it } from "vitest";
import { parseGitlabBaseUrl } from "../../../apps/api/src/gitlab-integration/utils/normalize-input";
import {
  assertGitlabTransport,
  normalizeGitlabBaseUrl,
  normalizeProjectPath,
} from "../../../apps/api/src/plugins/gitlab/config";
import { gitlabFetch } from "../../../apps/api/src/plugins/gitlab/utils/gitlab-api";

describe("normalizeGitlabBaseUrl", () => {
  it("keeps a plain base URL usable", () => {
    expect(normalizeGitlabBaseUrl("https://gitlab.com/")).toBe(
      "https://gitlab.com",
    );
    expect(normalizeGitlabBaseUrl("https://git.example/gitlab/")).toBe(
      "https://git.example/gitlab",
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

describe("normalizeProjectPath", () => {
  it("keeps a nested group path and drops surrounding slashes", () => {
    expect(normalizeProjectPath("/acme/platform/web/")).toBe(
      "acme/platform/web",
    );
  });

  it("requires a namespace", () => {
    expect(() => normalizeProjectPath("web")).toThrow(
      /must include a namespace/,
    );
  });

  it("rejects relative segments that would escape the project path", () => {
    expect(() => normalizeProjectPath("acme/../admin")).toThrow(
      /relative segments/,
    );
    expect(() => normalizeProjectPath("acme/./web")).toThrow(
      /relative segments/,
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
      await expect(
        gitlabFetch(target, "token", "private", "/user"),
      ).rejects.toThrow(/non-routable/);
    });
  }
});

describe("GitLab transport", () => {
  const originalAllowPrivate =
    process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS;

  afterEach(() => {
    if (originalAllowPrivate === undefined) {
      delete process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS;
    } else {
      process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS =
        originalAllowPrivate;
    }
  });

  it("does not send a token to a public host over plain http", async () => {
    delete process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS;

    await expect(
      gitlabFetch("http://93.184.216.34", "token", "private", "/user"),
    ).rejects.toThrow(/must use https/);
  });

  it("rejects a plain http URL entered in the form as a bad request", () => {
    delete process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS;

    expect(() => parseGitlabBaseUrl("http://gitlab.example.com")).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });

  it("allows plain http once private destinations are enabled", () => {
    process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS = "true";

    expect(() => assertGitlabTransport("http://10.0.0.5")).not.toThrow();
  });

  it("always allows https", () => {
    delete process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS;

    expect(() => assertGitlabTransport("https://gitlab.com")).not.toThrow();
  });
});

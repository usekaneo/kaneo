import { describe, expect, it } from "vite-plus/test";
import type { ExternalLink } from "@/types/external-link";
import {
  getPullRequestRepoName,
  getPullRequests,
  getPullRequestsStatus,
} from "./pull-request";

const link = (overrides: Partial<ExternalLink>): ExternalLink => ({
  id: "1",
  taskId: "t1",
  integrationId: null,
  resourceType: "pull_request",
  externalId: "1",
  url: "https://github.com/acme/repo/pull/1",
  title: null,
  metadata: null,
  ...overrides,
});

describe("getPullRequests", () => {
  it("keeps pull requests with safe web URLs", () => {
    expect(
      getPullRequests([
        link({ id: "pr" }),
        link({ id: "issue", resourceType: "issue" }),
        link({ id: "unsafe", url: "javascript:alert(1)" }),
      ]).map((pr) => pr.id),
    ).toEqual(["pr"]);
  });
});

describe("getPullRequestsStatus", () => {
  it("is merged only when every pull request is merged", () => {
    const merged = link({ metadata: { merged: true } });
    expect(getPullRequestsStatus([merged, merged])).toBe("merged");
    expect(getPullRequestsStatus([merged, link({})])).toBe("open");
    expect(
      getPullRequestsStatus([merged, link({ metadata: { draft: true } })]),
    ).toBe("draft");
  });
});

describe("getPullRequestRepoName", () => {
  it("reads the owner and repository from a GitHub URL", () => {
    expect(getPullRequestRepoName("https://github.com/acme/repo/pull/9")).toBe(
      "acme/repo",
    );
    expect(
      getPullRequestRepoName("https://gitlab.com/acme/repo/-/merge_requests/9"),
    ).toBeNull();
  });
});

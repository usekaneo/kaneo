import { describe, expect, it } from "vite-plus/test";
import { pullRequestNumber } from "../../../apps/api/src/external-link/pull-request-number";

describe("pullRequestNumber", () => {
  it.each([
    ["https://github.com/acme/app/pull/42", "42"],
    ["https://github.com/acme/app/pull/42/files", "42"],
    ["https://gitlab.com/acme/app/-/merge_requests/7", "7"],
    ["https://bitbucket.org/acme/app/pull-requests/9?tab=diff", "9"],
  ])("reads the number from %s", (url, number) => {
    expect(pullRequestNumber(url)).toBe(number);
  });

  it("returns null when the URL has no pull request number", () => {
    expect(
      pullRequestNumber("https://github.com/acme/app/issues/42"),
    ).toBeNull();
    expect(pullRequestNumber("https://example.com/pull/abc")).toBeNull();
  });
});

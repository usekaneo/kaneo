import { describe, expect, it } from "vite-plus/test";
import {
  createExternalLinkBody,
  updateExternalLinkBody,
} from "../../../apps/api/src/external-link/schema";

describe("manual resource URL validation", () => {
  it.each([
    "http://example.com",
    "https://example.com",
    "HTTPS://example.com",
    "HtTp://example.com",
  ])("accepts %s", (url) => {
    expect(createExternalLinkBody.safeParse({ url }).success).toBe(true);
  });

  it.each([
    "ftp://example.com",
    "javascript:alert(1)",
    "data:text/plain,test",
    "not a URL",
  ])("rejects %s", (url) => {
    expect(createExternalLinkBody.safeParse({ url }).success).toBe(false);
  });
});

describe("pull request links", () => {
  it("defaults to a resource link", () => {
    expect(
      createExternalLinkBody.parse({ url: "https://example.com" }).resourceType,
    ).toBe("url");
  });

  it("accepts a pull request with its status", () => {
    const parsed = createExternalLinkBody.parse({
      url: "https://github.com/acme/app/pull/42",
      resourceType: "pull_request",
      metadata: { state: "open", draft: true },
    });
    expect(parsed.metadata).toEqual({
      state: "open",
      merged: false,
      draft: true,
    });
  });

  it.each([
    { resourceType: "issue" },
    { resourceType: "pull_request", metadata: { state: "merged" } },
  ])("rejects %j", (extra) => {
    expect(
      createExternalLinkBody.safeParse({ url: "https://example.com", ...extra })
        .success,
    ).toBe(false);
  });

  it("requires something to update", () => {
    expect(updateExternalLinkBody.safeParse({}).success).toBe(false);
    expect(updateExternalLinkBody.safeParse({ title: "PR" }).success).toBe(
      true,
    );
  });
});

import { describe, expect, it } from "vitest";
import { createExternalLinkBody } from "../../../apps/api/src/external-link/schema";

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

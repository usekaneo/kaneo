import { describe, expect, it } from "vite-plus/test";
import { createExternalLinkBody } from "../../../apps/api/src/external-link/schema";

describe("manual resource URL validation", () => {
  it.each([
    "http://example.com",
    "https://example.com",
    "HTTPS://example.com",
    "HtTp://example.com",
    "ftp://example.com",
    "obsidian://open?vault=Agents&file=%2B%2F2026-08-23%20Notes",
    "vscode://file/home/user/project",
  ])("accepts %s", (url) => {
    expect(createExternalLinkBody.safeParse({ url }).success).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    " javascript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/plain,test",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "blob:https://example.com/uuid",
    "not a URL",
  ])("rejects %s", (url) => {
    expect(createExternalLinkBody.safeParse({ url }).success).toBe(false);
  });
});

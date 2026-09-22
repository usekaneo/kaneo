import { afterEach, describe, expect, it, vi } from "vitest";
import { getExternalWebUrl, openExternalWebUrl } from "./external-url";

afterEach(() => vi.restoreAllMocks());
describe("stored external links", () => {
  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "\njavascript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "//example.com/pr/1",
    "/pr/1",
    "https://user:password@example.com/pr/1",
    "invalid",
  ])("rejects %s without opening a window", (value) => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    expect(getExternalWebUrl(value)).toBeNull();
    openExternalWebUrl(value);
    expect(open).not.toHaveBeenCalled();
  });
  it.each([
    "https://github.com/owner/repo/pull/1",
    "http://gitea.internal/org/repo/pulls/1",
  ])("opens legitimate provider links without an opener: %s", (value) => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    openExternalWebUrl(value);
    expect(open).toHaveBeenCalledWith(value, "_blank", "noopener,noreferrer");
  });
});

import { describe, expect, it } from "vitest";
import { baseUrlFromProjectWebUrl } from "../../../../apps/api/src/plugins/gitlab/utils/webhook-repo";

describe("baseUrlFromProjectWebUrl", () => {
  it("strips a top-level project path", () => {
    expect(
      baseUrlFromProjectWebUrl(
        "https://gitlab.example.com/owner/repo",
        "owner/repo",
      ),
    ).toBe("https://gitlab.example.com");
  });

  it("strips an arbitrarily nested group/subgroup path", () => {
    expect(
      baseUrlFromProjectWebUrl(
        "https://gitlab.example.com/group/subgroup/project",
        "group/subgroup/project",
      ),
    ).toBe("https://gitlab.example.com");
  });

  it("returns an empty string when the web_url does not end with path_with_namespace", () => {
    expect(
      baseUrlFromProjectWebUrl(
        "https://gitlab.example.com/other/path",
        "group/project",
      ),
    ).toBe("");
  });

  it("returns an empty string for an unparsable URL", () => {
    expect(baseUrlFromProjectWebUrl("not-a-url", "group/project")).toBe("");
  });
});

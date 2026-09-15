import { describe, expect, it } from "vitest";
import { baseUrlFromProjectWebUrl } from "../../../../../apps/api/src/plugins/gitlab/utils/webhook-project";

describe("baseUrlFromProjectWebUrl", () => {
  it("returns the origin for a project at the instance root", () => {
    expect(
      baseUrlFromProjectWebUrl("https://gitlab.com/acme/web", "acme/web"),
    ).toBe("https://gitlab.com");
  });

  it("keeps the path prefix of an instance served under a subpath", () => {
    expect(
      baseUrlFromProjectWebUrl(
        "https://git.example.com/gitlab/acme/web",
        "acme/web",
      ),
    ).toBe("https://git.example.com/gitlab");
  });

  it("handles a project in nested groups", () => {
    expect(
      baseUrlFromProjectWebUrl(
        "https://gitlab.com/acme/platform/web",
        "acme/platform/web",
      ),
    ).toBe("https://gitlab.com");
  });

  it("returns empty when the web URL does not end in the project path", () => {
    expect(
      baseUrlFromProjectWebUrl("https://gitlab.com/acme/web", "other/repo"),
    ).toBe("");
  });

  it("returns empty for a URL it cannot parse", () => {
    expect(baseUrlFromProjectWebUrl("not a url", "acme/web")).toBe("");
  });
});

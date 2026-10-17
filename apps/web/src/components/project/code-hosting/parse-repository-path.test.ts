import { describe, expect, it } from "vite-plus/test";
import {
  formatRepositoryPath,
  GITEA_OWNER_PATTERN,
  GITHUB_OWNER_PATTERN,
  parseRepositoryPath,
} from "./parse-repository-path";

describe("parseRepositoryPath", () => {
  it("splits owner and name and ignores surrounding space and slashes", () => {
    expect(
      parseRepositoryPath(" /acme/web.site/ ", GITHUB_OWNER_PATTERN),
    ).toEqual({ owner: "acme", name: "web.site" });
  });

  it.each([
    "",
    "acme",
    "acme/",
    "/web",
    "acme/web/extra",
    "ac me/web",
    "acme/we b",
  ])("rejects %j", (value) => {
    expect(parseRepositoryPath(value, GITHUB_OWNER_PATTERN)).toBeNull();
  });

  it("applies the provider's owner rules", () => {
    expect(parseRepositoryPath("my_org/web", GITHUB_OWNER_PATTERN)).toBeNull();
    expect(parseRepositoryPath("my_org/web", GITEA_OWNER_PATTERN)).toEqual({
      owner: "my_org",
      name: "web",
    });
  });
});

describe("formatRepositoryPath", () => {
  it("joins both parts or returns an empty string", () => {
    expect(formatRepositoryPath("acme", "web")).toBe("acme/web");
    expect(formatRepositoryPath("", "web")).toBe("");
  });
});

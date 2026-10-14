import { describe, expect, it } from "vite-plus/test";
import { generateBranchName } from "./branch-name";

describe("generateBranchName", () => {
  it("adds the title to the default pattern", () => {
    expect(generateBranchName(undefined, "KAN", 42, "Add rate limiting!")).toBe(
      "kan-42-add-rate-limiting",
    );
  });

  it("follows a custom integration pattern", () => {
    expect(
      generateBranchName("feature/{number}-{title}", "KAN", 7, "Fix login"),
    ).toBe("feature/7-fix-login");
  });

  it("needs a project slug and task number", () => {
    expect(generateBranchName(undefined, undefined, 7, "Fix")).toBe("");
    expect(generateBranchName(undefined, "KAN", null, "Fix")).toBe("");
  });
});

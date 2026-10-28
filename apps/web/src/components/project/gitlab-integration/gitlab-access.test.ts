import { describe, expect, it } from "vite-plus/test";
import {
  gitlabAccessKey,
  isValidProjectPath,
  normalizeProjectPath,
} from "./gitlab-access";

describe("GitLab project paths", () => {
  it("accepts nested groups and trims surrounding slashes", () => {
    expect(normalizeProjectPath(" /group/sub/project/ ")).toBe(
      "group/sub/project",
    );
    expect(isValidProjectPath("group/sub/project")).toBe(true);
    expect(isValidProjectPath("project")).toBe(false);
    expect(isValidProjectPath("group/pro ject")).toBe(false);
  });
});

describe("gitlabAccessKey", () => {
  it("changes with the token without containing it", () => {
    const access = {
      baseUrl: "https://gitlab.com",
      tokenType: "private" as const,
      projectPath: "group/project",
    };
    const first = gitlabAccessKey({ ...access, accessToken: "secret-one" });
    const second = gitlabAccessKey({ ...access, accessToken: "secret-two" });
    expect(first).not.toBe(second);
    expect(first).not.toContain("secret-one");
  });
});

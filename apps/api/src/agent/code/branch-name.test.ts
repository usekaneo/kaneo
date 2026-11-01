import { describe, expect, it } from "vite-plus/test";
import {
  extractTaskNumber,
  extractTaskNumberFromBranch,
} from "../../plugins/github/utils/branch-matcher";
import { codeJobBranchName, pullRequestTitle, taskKey } from "./branch-name";

const task = { number: 135, title: "Fix WebSocket reconnect loop" };

describe("coding job branch names", () => {
  it.each([
    "{slug}-{number}",
    "{slug}-{number}-{title}",
    "{number}",
    "{number}-{title}",
    "feature/{slug}-{number}",
    "feature/{number}-{title}",
    "fix/{slug}-{number}",
    "fix/{number}-{title}",
  ])("links back to the task with pattern %s", (branchPattern) => {
    const branch = codeJobBranchName(
      { branchPattern },
      "WEB",
      task,
      "cjob1x7k2qa",
    );
    expect(branch).toMatch(/-kaneo-x7k2qa$/);
    expect(extractTaskNumberFromBranch(branch, { branchPattern }, "WEB")).toBe(
      135,
    );
  });

  it("uses the default pattern with the integration's default config", () => {
    expect(codeJobBranchName({}, "WEB", task, "abcdefghijk")).toBe(
      "web-135-kaneo-fghijk",
    );
  });

  it("falls back to the title key for custom branch regexes", () => {
    const config = { customBranchRegex: "^task/(\\d+)$" };
    const branch = codeJobBranchName(config, "WEB", task, "abcdefghijk");
    expect(branch).toBe("web-135-kaneo-fghijk");
    expect(
      extractTaskNumber(
        branch,
        pullRequestTitle("WEB-135", "Fix reconnect"),
        undefined,
        config,
        "WEB",
      ),
    ).toBe(135);
  });

  it("drops trailing separators from titles without ASCII letters", () => {
    expect(
      codeJobBranchName(
        { branchPattern: "{number}-{title}" },
        "web",
        { number: 7, title: "修复" },
        "abcdefghijk",
      ),
    ).toBe("7-kaneo-fghijk");
  });

  it("names a branch for tasks without numbers", () => {
    expect(
      codeJobBranchName({}, "web", { number: null, title: "x" }, "abcdefghijk"),
    ).toBe("kaneo-agent-kaneo-fghijk");
  });
});

describe("pull request titles", () => {
  it("leads with the task key once", () => {
    expect(taskKey("web", 135)).toBe("WEB-135");
    expect(pullRequestTitle("WEB-135", "Fix reconnect loop")).toBe(
      "WEB-135: Fix reconnect loop",
    );
    expect(pullRequestTitle("WEB-135", "WEB-135: Fix reconnect loop")).toBe(
      "WEB-135: Fix reconnect loop",
    );
    expect(pullRequestTitle(null, "  Fix\nloop ")).toBe("Fix loop");
  });
});

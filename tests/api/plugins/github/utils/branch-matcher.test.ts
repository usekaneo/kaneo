import { afterEach, describe, expect, it, vi } from "vitest";
import type { GitHubConfig } from "../../../../../apps/api/src/plugins/github/config";
import {
  createBranchRegex,
  extractTaskNumber,
  extractTaskNumberFromBranch,
  extractTaskNumberFromPRBody,
  extractTaskNumberFromPRTitle,
  generateBranchName,
} from "../../../../../apps/api/src/plugins/github/utils/branch-matcher";

const baseConfig: GitHubConfig = {
  repositoryOwner: "kaneo",
  repositoryName: "api",
  installationId: 1,
  branchPattern: "{slug}-{number}",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generateBranchName", () => {
  it("fills placeholders and slugifies the title", () => {
    expect(
      generateBranchName(
        "feature/{slug}-{number}-{title}",
        "KAN",
        42,
        "Fix login: SSO + invites",
      ),
    ).toBe("feature/kan-42-fix-login-sso-invites");
  });
});

describe("createBranchRegex", () => {
  it("matches default patterns and optional suffixes", () => {
    const regex = createBranchRegex("{slug}-{number}-{title}", "KAN");

    expect(regex.test("kan-7-polish-sidebar")).toBe(true);
    expect(regex.test("kan-7-polish-sidebar-part-2")).toBe(true);
    expect(regex.test("ops-7-polish-sidebar")).toBe(false);
  });
});

describe("branch names round trip", () => {
  // slugify keeps only ASCII alphanumerics, so a title written in any other
  // script leaves nothing where {title} goes. Four of the eight patterns
  // offered in the integration settings carry {title}.
  const pattern = "{slug}-{number}-{title}";
  const config = { ...baseConfig, branchPattern: pattern };

  it.each([
    ["Проверка входа", "Cyrillic"],
    ["ログイン修正", "Japanese"],
    ["登录修复", "Chinese"],
    ["수정", "Korean"],
    ["Διόρθωση", "Greek"],
  ])("matches the branch it generated for %s (%s)", (title) => {
    const branch = generateBranchName(pattern, "KAN", 42, title);

    expect(extractTaskNumberFromBranch(branch, config, "KAN")).toBe(42);
  });

  it("matches the branch it generated for a Latin title", () => {
    const branch = generateBranchName(pattern, "KAN", 42, "Fix the login bug");

    expect(branch).toBe("kan-42-fix-the-login-bug");
    expect(extractTaskNumberFromBranch(branch, config, "KAN")).toBe(42);
  });
});

describe("extractTaskNumberFromBranch", () => {
  it("uses the default branch pattern", () => {
    expect(
      extractTaskNumberFromBranch("kan-17-refine-search", baseConfig, "KAN"),
    ).toBe(17);
  });

  it("supports custom regex patterns", () => {
    expect(
      extractTaskNumberFromBranch(
        "feature/TASK-33",
        {
          ...baseConfig,
          customBranchRegex: "TASK-(\\d+)",
        },
        "KAN",
      ),
    ).toBe(33);
  });

  it("returns null and logs when the custom regex is invalid", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    expect(
      extractTaskNumberFromBranch(
        "feature/TASK-33",
        {
          ...baseConfig,
          customBranchRegex: "(",
        },
        "KAN",
      ),
    ).toBeNull();
    expect(consoleError).toHaveBeenCalledOnce();
  });
});

describe("extractTaskNumberFromPRTitle", () => {
  it("recognizes supported title formats", () => {
    expect(extractTaskNumberFromPRTitle("[12] Ship notifications")).toBe(12);
    expect(extractTaskNumberFromPRTitle("Fix sidebar (#34)")).toBe(34);
    expect(extractTaskNumberFromPRTitle("55: tidy auth flow")).toBe(55);
  });
});

describe("extractTaskNumberFromPRBody", () => {
  it("recognizes task references in the body", () => {
    expect(extractTaskNumberFromPRBody("Closes #21")).toBe(21);
    expect(extractTaskNumberFromPRBody("task: 77")).toBe(77);
    expect(extractTaskNumberFromPRBody("No linked task")).toBeNull();
  });
});

describe("extractTaskNumber", () => {
  it("prefers the branch match before title and body", () => {
    expect(
      extractTaskNumber(
        "kan-88-polish-editor",
        "[12] Ship notifications",
        "Closes #21",
        baseConfig,
        "KAN",
      ),
    ).toBe(88);
  });

  it("falls back to the title and then body", () => {
    expect(
      extractTaskNumber(
        "misc-branch",
        "[12] Ship notifications",
        "Closes #21",
        baseConfig,
        "KAN",
      ),
    ).toBe(12);

    expect(
      extractTaskNumber(
        "misc-branch",
        undefined,
        "Resolves task 21",
        baseConfig,
        "KAN",
      ),
    ).toBe(21);
  });

  it("accepts task number 0 from the branch before other matches", () => {
    expect(
      extractTaskNumber(
        "kan-0-initial-setup",
        "[99] Other task",
        undefined,
        baseConfig,
        "KAN",
      ),
    ).toBe(0);
  });
});

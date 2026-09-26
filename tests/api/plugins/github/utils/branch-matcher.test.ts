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
  it.each(["task 21", "task: 21", "task-21", "task#21"])(
    "recognizes the delimited marker %s in titles and bodies",
    (reference) => {
      const projectSlug = "KAN";

      const titleTaskNumber = extractTaskNumberFromPRTitle(
        reference,
        projectSlug,
      );
      const bodyTaskNumber = extractTaskNumberFromPRBody(
        reference,
        projectSlug,
      );

      expect(titleTaskNumber).toBe(21);
      expect(bodyTaskNumber).toBe(21);
    },
  );

  it("recognizes explicit task references", () => {
    const projectSlug = "KAN";
    const conventionalTitle = "feat(KAN-42): copy text";
    const bracketedTitle = "[kan-42] Copy text";
    const taskMarkerTitle = "Task: 55 tidy auth flow";

    const conventionalTaskNumber = extractTaskNumberFromPRTitle(
      conventionalTitle,
      projectSlug,
    );
    const bracketedTaskNumber = extractTaskNumberFromPRTitle(
      bracketedTitle,
      projectSlug,
    );
    const markerTaskNumber = extractTaskNumberFromPRTitle(
      taskMarkerTitle,
      projectSlug,
    );

    expect(conventionalTaskNumber).toBe(42);
    expect(bracketedTaskNumber).toBe(42);
    expect(markerTaskNumber).toBe(55);
  });

  it.each([
    "[12] Ship notifications",
    "Fix sidebar (#34)",
    "55: tidy auth flow",
    "Release (61)",
    "feat(OTHER-42): copy text",
    "feat(XKAN-42): copy text",
    "feat(KAN-42extra): copy text",
    "task42",
    "Refactor task61 renderer",
  ])("does not treat %s as a local task", (title) => {
    const projectSlug = "KAN";

    const taskNumber = extractTaskNumberFromPRTitle(title, projectSlug);

    expect(taskNumber).toBeNull();
  });
});

describe("extractTaskNumberFromPRBody", () => {
  it("recognizes task references in the body", () => {
    const projectSlug = "KAN";
    const issueReference = "Closes #21";
    const taskMarker = "task: 77";
    const projectReference = "Implements KAN-42";
    const unlinkedBody = "No linked task";

    const issueTaskNumber = extractTaskNumberFromPRBody(issueReference);
    const markerTaskNumber = extractTaskNumberFromPRBody(taskMarker);
    const projectTaskNumber = extractTaskNumberFromPRBody(
      projectReference,
      projectSlug,
    );
    const unlinkedTaskNumber = extractTaskNumberFromPRBody(unlinkedBody);

    expect(issueTaskNumber).toBeNull();
    expect(markerTaskNumber).toBe(77);
    expect(projectTaskNumber).toBe(42);
    expect(unlinkedTaskNumber).toBeNull();
  });

  it.each([
    "Closes #61",
    "Fixes #61",
    "Resolves #61",
    "Closes 61",
    "Fixes acme/repo#61",
    "task42",
    "Refactor task61 renderer",
  ])("does not interpret %s as a local task", (body) => {
    const projectSlug = "KAN";

    const taskNumber = extractTaskNumberFromPRBody(body, projectSlug);

    expect(taskNumber).toBeNull();
  });
});

describe("extractTaskNumber", () => {
  it("prefers the branch match before title and body", () => {
    expect(
      extractTaskNumber(
        "kan-88-polish-editor",
        "[KAN-12] Ship notifications",
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
        "[KAN-12] Ship notifications",
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

  it("does not confuse the remote closing issue with a project key", () => {
    expect(
      extractTaskNumber(
        "codex/kan-42-copy-message-text",
        "feat(KAN-42): copy message text",
        "Closes #61",
        baseConfig,
        "KAN",
      ),
    ).toBe(42);
  });

  it("leaves issue-only references for remote issue resolution", () => {
    expect(
      extractTaskNumber(
        "misc-branch",
        "Fix #61",
        "Closes #61",
        baseConfig,
        "KAN",
      ),
    ).toBeNull();
  });
});

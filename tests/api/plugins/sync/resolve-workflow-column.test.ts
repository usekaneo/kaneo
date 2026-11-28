import { describe, expect, it, vi } from "vite-plus/test";
import { resolveTargetStatus as resolveGiteaTargetStatus } from "../../../../apps/api/src/plugins/gitea/utils/resolve-column";
import { resolveTargetStatus as resolveGithubTargetStatus } from "../../../../apps/api/src/plugins/github/utils/resolve-column";
import { resolveTargetStatus as resolveGitlabTargetStatus } from "../../../../apps/api/src/plugins/gitlab/utils/resolve-column";
import {
  resolveWorkflowColumnSlug,
  type WorkflowResolutionDb,
} from "../../../../apps/api/src/plugins/sync/resolve-workflow-column";

function createMockDb(
  columns: Array<{ id: string; slug: string }>,
  rule?: { columnId: string } | null,
): WorkflowResolutionDb {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: vi.fn().mockResolvedValue(columns),
        }),
      }),
    }),
    query: {
      workflowRuleTable: {
        findFirst: vi.fn().mockResolvedValue(rule ?? undefined),
      },
    },
  } as unknown as WorkflowResolutionDb;
}

describe("resolveWorkflowColumnSlug", () => {
  const customColumns = [
    { id: "col-waiting", slug: "waiting" },
    { id: "col-review", slug: "review" },
    { id: "col-done", slug: "done" },
  ];

  it("returns the mapped column slug when a matching workflow rule exists", async () => {
    const mockDb = createMockDb(customColumns, { columnId: "col-done" });

    await expect(
      resolveWorkflowColumnSlug("proj-1", "github", "pr_merged", null, mockDb),
    ).resolves.toBe("done");
  });

  it("returns null when no rule exists and fallbackStatus is null (Don't move)", async () => {
    const mockDb = createMockDb(customColumns);

    await expect(
      resolveWorkflowColumnSlug(
        "proj-1",
        "github",
        "branch_push",
        null,
        mockDb,
      ),
    ).resolves.toBeNull();
    await expect(
      resolveWorkflowColumnSlug("proj-1", "gitlab", "pr_opened", null, mockDb),
    ).resolves.toBeNull();
    await expect(
      resolveWorkflowColumnSlug(
        "proj-1",
        "gitea",
        "issue_closed",
        null,
        mockDb,
      ),
    ).resolves.toBeNull();
  });

  it("returns null when project has no columns and fallbackStatus is null", async () => {
    const mockDb = createMockDb([]);

    await expect(
      resolveWorkflowColumnSlug("proj-1", "github", "pr_merged", null, mockDb),
    ).resolves.toBeNull();
  });

  it("returns matching fallback column or first column when fallbackStatus is a non-null string", async () => {
    const mockDb = createMockDb(customColumns);

    await expect(
      resolveWorkflowColumnSlug(
        "proj-1",
        "github",
        "issue_opened",
        "review",
        mockDb,
      ),
    ).resolves.toBe("review");

    await expect(
      resolveWorkflowColumnSlug(
        "proj-1",
        "github",
        "issue_opened",
        "to-do",
        mockDb,
      ),
    ).resolves.toBe("waiting");
  });

  it("preserves provider wrappers for github, gitlab, and gitea", async () => {
    const unmappedDb = createMockDb(customColumns);
    await expect(
      resolveGithubTargetStatus("proj-1", "branch_push", null, unmappedDb),
    ).resolves.toBeNull();
    await expect(
      resolveGitlabTargetStatus("proj-1", "pr_opened", null, unmappedDb),
    ).resolves.toBeNull();
    await expect(
      resolveGiteaTargetStatus("proj-1", "issue_reopened", null, unmappedDb),
    ).resolves.toBeNull();

    const mappedDb = createMockDb(customColumns, { columnId: "col-review" });
    await expect(
      resolveGithubTargetStatus("proj-1", "pr_opened", null, mappedDb),
    ).resolves.toBe("review");
    await expect(
      resolveGitlabTargetStatus("proj-1", "pr_opened", null, mappedDb),
    ).resolves.toBe("review");
    await expect(
      resolveGiteaTargetStatus("proj-1", "pr_opened", null, mappedDb),
    ).resolves.toBe("review");
  });
});

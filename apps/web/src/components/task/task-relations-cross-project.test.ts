import { describe, expect, it } from "vitest";
import {
  buildCrossProjectTaskGroups,
  type CrossProjectSearchResult,
} from "./task-relations-cross-project";

function result(
  overrides: Partial<CrossProjectSearchResult> & { id: string },
): CrossProjectSearchResult {
  return {
    type: "task",
    title: "Untitled",
    ...overrides,
  };
}

describe("buildCrossProjectTaskGroups", () => {
  it("groups matching tasks by their project, sorted by project name", () => {
    const groups = buildCrossProjectTaskGroups({
      results: [
        result({
          id: "task-b1",
          title: "Ship the release",
          projectId: "project-b",
          projectName: "Beta",
          projectSlug: "BETA",
          taskNumber: 4,
          status: "to-do",
        }),
        result({
          id: "task-a1",
          title: "Fix the login bug",
          projectId: "project-a",
          projectName: "Alpha",
          projectSlug: "ALPHA",
          taskNumber: 1,
          status: "done",
        }),
        result({
          id: "task-a2",
          title: "Fix the signup bug",
          projectId: "project-a",
          projectName: "Alpha",
          projectSlug: "ALPHA",
          taskNumber: 2,
          status: "to-do",
        }),
      ],
      currentProjectId: "project-current",
      excludedTaskIds: new Set(),
      labelForProject: (name) => `In ${name}`,
    });

    expect(groups.map((g) => g.label)).toEqual(["In Alpha", "In Beta"]);
    expect(groups[0]?.items.map((i) => i.id)).toEqual(["task-a1", "task-a2"]);
    expect(groups[1]?.items.map((i) => i.id)).toEqual(["task-b1"]);
  });

  it("excludes tasks from the current project, since those have their own group already", () => {
    const groups = buildCrossProjectTaskGroups({
      results: [
        result({
          id: "task-same-project",
          projectId: "project-current",
          projectName: "Current",
        }),
        result({
          id: "task-other-project",
          projectId: "project-other",
          projectName: "Other",
        }),
      ],
      currentProjectId: "project-current",
      excludedTaskIds: new Set(),
      labelForProject: (name) => name,
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.items.map((i) => i.id)).toEqual(["task-other-project"]);
  });

  it("excludes the task itself and tasks it is already related to", () => {
    const groups = buildCrossProjectTaskGroups({
      results: [
        result({ id: "self", projectId: "project-other" }),
        result({ id: "already-related", projectId: "project-other" }),
        result({ id: "linkable", projectId: "project-other" }),
      ],
      currentProjectId: "project-current",
      excludedTaskIds: new Set(["self", "already-related"]),
      labelForProject: (name) => name,
    });

    expect(groups[0]?.items.map((i) => i.id)).toEqual(["linkable"]);
  });

  it("ignores non-task results and results without a project id", () => {
    const groups = buildCrossProjectTaskGroups({
      results: [
        result({
          id: "a-project",
          type: "project",
          projectId: "project-other",
        }),
        result({ id: "no-project", projectId: undefined }),
        result({ id: "valid", projectId: "project-other" }),
      ],
      currentProjectId: "project-current",
      excludedTaskIds: new Set(),
      labelForProject: (name) => name,
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.items.map((i) => i.id)).toEqual(["valid"]);
  });

  it("falls back to the project slug for the group label when no project name is returned", () => {
    const groups = buildCrossProjectTaskGroups({
      results: [
        result({
          id: "task-1",
          projectId: "project-other",
          projectName: undefined,
          projectSlug: "OTHER",
        }),
      ],
      currentProjectId: "project-current",
      excludedTaskIds: new Set(),
      labelForProject: (name) => `In ${name}`,
    });

    expect(groups[0]?.label).toBe("In OTHER");
  });
});

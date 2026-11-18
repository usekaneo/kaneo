import { describe, expect, it } from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import type Sprint from "@/types/sprint";
import {
  DEFAULT_SPRINT_SCOPE,
  filterProjectBySprintScope,
  normalizeSprintScope,
  sprintScopeTaskMatcher,
  type SprintScope,
} from "./sprint-scope";

function sprint(partial: Partial<Sprint>): Sprint {
  return {
    id: "sprint-1",
    projectId: "project",
    name: "Sprint 1",
    goal: null,
    status: "future",
    startDate: null,
    endDate: null,
    carryOverTasks: null,
    position: 0,
    taskCount: 0,
    completedTaskCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function project() {
  return {
    id: "project",
    columns: [
      {
        id: "to-do",
        slug: "to-do",
        name: "To do",
        icon: null,
        isFinal: false,
        tasks: [
          { id: "a", status: "to-do", sprintId: "sprint-active" },
          { id: "b", status: "to-do", sprintId: "sprint-2" },
          { id: "c", status: "to-do", sprintId: null },
        ],
      },
    ],
    plannedTasks: [{ id: "d", status: "planned", sprintId: null }],
    archivedTasks: [{ id: "e", status: "archived", sprintId: "sprint-active" }],
  } as unknown as ProjectWithTasks;
}

function sprints(): Sprint[] {
  return [
    sprint({ id: "sprint-active", status: "active", position: 0 }),
    sprint({ id: "sprint-2", status: "future", position: 1 }),
    sprint({ id: "sprint-old", status: "closed", position: 2 }),
  ];
}

function visibleTaskIds(scope: SprintScope) {
  const filtered = filterProjectBySprintScope(project(), scope, sprints());
  return [
    ...filtered.columns.flatMap((column) => column.tasks.map((t) => t.id)),
    ...filtered.plannedTasks.map((t) => t.id),
  ].sort();
}

describe("sprintScopeTaskMatcher", () => {
  it("keeps the whole board for the all scope", () => {
    expect(sprintScopeTaskMatcher("all", sprints())).toBeNull();
  });

  it("matches only the active sprint for the current scope", () => {
    const matcher = sprintScopeTaskMatcher("current", sprints());
    expect(matcher).not.toBeNull();
    expect(matcher!({ sprintId: "sprint-active" } as never)).toBe(true);
    expect(matcher!({ sprintId: "sprint-2" } as never)).toBe(false);
  });

  it("does not restrict anything for the current scope without an active sprint", () => {
    expect(
      sprintScopeTaskMatcher("current", [sprint({ status: "future" })]),
    ).toBeNull();
  });

  it("matches tasks without a sprint for the backlog scope", () => {
    const matcher = sprintScopeTaskMatcher("backlog", sprints());
    expect(matcher).not.toBeNull();
    expect(matcher!({ sprintId: null } as never)).toBe(true);
    expect(matcher!({ sprintId: "sprint-active" } as never)).toBe(false);
  });

  it("matches a concrete sprint id", () => {
    const matcher = sprintScopeTaskMatcher("sprint-2", sprints());
    expect(matcher).not.toBeNull();
    expect(matcher!({ sprintId: "sprint-2" } as never)).toBe(true);
  });

  it("does not restrict anything for a deleted sprint id", () => {
    expect(sprintScopeTaskMatcher("sprint-gone", sprints())).toBeNull();
  });
});

describe("filterProjectBySprintScope", () => {
  it("filters columns and planned tasks to the current sprint", () => {
    expect(visibleTaskIds("current")).toEqual(["a"]);
  });

  it("filters to the unscheduled backlog", () => {
    expect(visibleTaskIds("backlog")).toEqual(["c", "d"]);
  });

  it("keeps every task for the all scope", () => {
    expect(visibleTaskIds("all")).toEqual(["a", "b", "c", "d"]);
  });
});

describe("normalizeSprintScope", () => {
  it("accepts known scope values and sprint ids", () => {
    expect(normalizeSprintScope("current")).toBe("current");
    expect(normalizeSprintScope("all")).toBe("all");
    expect(normalizeSprintScope("backlog")).toBe("backlog");
    expect(normalizeSprintScope("sprint-2")).toBe("sprint-2");
  });

  it("falls back to the default scope for unusable values", () => {
    expect(normalizeSprintScope(null)).toBe(DEFAULT_SPRINT_SCOPE);
    expect(normalizeSprintScope(42)).toBe(DEFAULT_SPRINT_SCOPE);
    expect(normalizeSprintScope("")).toBe(DEFAULT_SPRINT_SCOPE);
    expect(normalizeSprintScope("x".repeat(129))).toBe(DEFAULT_SPRINT_SCOPE);
  });
});

import { describe, expect, it } from "vitest";
import { recalculateVisibleSubtaskCounts } from "@/lib/recalculate-visible-subtask-counts";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";

function createTask(
  overrides: Partial<Task> & Pick<Task, "id" | "title">,
): Task {
  return {
    number: 1,
    description: null,
    status: "to-do",
    priority: null,
    startDate: null,
    dueDate: null,
    position: 0,
    createdAt: "2024-01-01T00:00:00.000Z",
    userId: null,
    assigneeId: null,
    assigneeName: null,
    projectId: "project-1",
    parentId: null,
    directSubtaskCount: 0,
    completedSubtaskCount: 0,
    ...overrides,
  };
}

describe("recalculateVisibleSubtaskCounts", () => {
  it("recounts only children still present after filtering", () => {
    const project = {
      id: "project-1",
      name: "Project",
      slug: "proj",
      icon: null,
      description: null,
      isPublic: false,
      workspaceId: "ws-1",
      archivedTasks: [],
      plannedTasks: [],
      columns: [
        {
          id: "to-do",
          slug: "to-do",
          name: "To Do",
          icon: null,
          isFinal: false,
          tasks: [
            createTask({
              id: "parent",
              title: "Parent",
              status: "to-do",
              // Stale API counts that included a filtered-out child
              directSubtaskCount: 2,
              completedSubtaskCount: 1,
            }),
            createTask({
              id: "visible-child",
              title: "Visible",
              status: "to-do",
              parentId: "parent",
            }),
          ],
        },
        {
          id: "done",
          slug: "done",
          name: "Done",
          icon: null,
          isFinal: true,
          tasks: [],
        },
      ],
    } as ProjectWithTasks;

    const result = recalculateVisibleSubtaskCounts(project);
    const parent = result.columns[0]?.tasks.find(
      (task) => task.id === "parent",
    );

    expect(parent?.directSubtaskCount).toBe(1);
    expect(parent?.completedSubtaskCount).toBe(0);
  });

  it("counts completed children in final columns", () => {
    const project = {
      id: "project-1",
      name: "Project",
      slug: "proj",
      icon: null,
      description: null,
      isPublic: false,
      workspaceId: "ws-1",
      archivedTasks: [],
      plannedTasks: [],
      columns: [
        {
          id: "to-do",
          slug: "to-do",
          name: "To Do",
          icon: null,
          isFinal: false,
          tasks: [
            createTask({
              id: "parent",
              title: "Parent",
              status: "to-do",
              directSubtaskCount: 99,
              completedSubtaskCount: 99,
            }),
          ],
        },
        {
          id: "done",
          slug: "done",
          name: "Done",
          icon: null,
          isFinal: true,
          tasks: [
            createTask({
              id: "done-child",
              title: "Done child",
              status: "done",
              parentId: "parent",
            }),
          ],
        },
      ],
    } as ProjectWithTasks;

    const result = recalculateVisibleSubtaskCounts(project);
    const parent = result.columns[0]?.tasks.find(
      (task) => task.id === "parent",
    );

    expect(parent?.directSubtaskCount).toBe(1);
    expect(parent?.completedSubtaskCount).toBe(1);
  });
});

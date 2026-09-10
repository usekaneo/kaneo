import { describe, expect, it } from "vitest";
import type Task from "@/types/task";
import { removeTaskFromProject } from "./remove-task-from-project";

function task(id: string, status: string): Task {
  return {
    id,
    title: id,
    number: 1,
    description: null,
    status,
    priority: null,
    startDate: null,
    dueDate: null,
    position: 0,
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
    userId: null,
    assigneeId: null,
    assigneeName: null,
    projectId: "project-1",
  };
}

describe("removeTaskFromProject", () => {
  it("removes a deleted task from active, planned, and archived collections", () => {
    const baseProject = {
      id: "project-1",
      name: "Project",
      slug: "PROJ",
      icon: null,
      description: null,
      isPublic: false,
      createdAt: "2026-08-31T00:00:00.000Z",
      updatedAt: "2026-08-31T00:00:00.000Z",
      workspaceId: "workspace-1",
      columns: [
        {
          id: "todo",
          slug: "to-do",
          name: "To Do",
          icon: null,
          isFinal: false,
          tasks: [task("delete-me", "to-do"), task("keep-me", "to-do")],
        },
      ],
      plannedTasks: [task("delete-me", "planned")],
      archivedTasks: [task("delete-me", "archived")],
    };

    const updatedProject = removeTaskFromProject(baseProject, "delete-me");

    expect(updatedProject.columns[0]?.tasks.map(({ id }) => id)).toEqual([
      "keep-me",
    ]);
    expect(updatedProject.plannedTasks).toEqual([]);
    expect(updatedProject.archivedTasks).toEqual([]);
  });
});

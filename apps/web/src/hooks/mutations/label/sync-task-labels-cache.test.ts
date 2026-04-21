import { describe, expect, it } from "vitest";
import { updateTaskLabelsInProject } from "./sync-task-labels-cache";

describe("updateTaskLabelsInProject", () => {
  it("adds a label to the matching task without changing other tasks", () => {
    const project = {
      id: "project-1",
      name: "Project",
      slug: "PROJ",
      icon: null,
      description: null,
      isPublic: false,
      createdAt: "2026-04-16T00:00:00.000Z",
      updatedAt: "2026-04-16T00:00:00.000Z",
      workspaceId: "workspace-1",
      columns: [
        {
          id: "todo",
          name: "Todo",
          isFinal: false,
          tasks: [
            {
              id: "task-1",
              title: "Task 1",
              number: 1,
              description: null,
              status: "todo",
              priority: null,
              startDate: null,
              dueDate: null,
              position: 0,
              createdAt: "2026-04-16T00:00:00.000Z",
              updatedAt: "2026-04-16T00:00:00.000Z",
              userId: null,
              assigneeId: null,
              assigneeName: null,
              assigneeImage: null,
              projectId: "project-1",
              labels: [],
              externalLinks: [],
            },
            {
              id: "task-2",
              title: "Task 2",
              number: 2,
              description: null,
              status: "todo",
              priority: null,
              startDate: null,
              dueDate: null,
              position: 1,
              createdAt: "2026-04-16T00:00:00.000Z",
              updatedAt: "2026-04-16T00:00:00.000Z",
              userId: null,
              assigneeId: null,
              assigneeName: null,
              assigneeImage: null,
              projectId: "project-1",
              labels: [],
              externalLinks: [],
            },
          ],
        },
      ],
      plannedTasks: [],
      archivedTasks: [],
    };

    const updatedProject = updateTaskLabelsInProject(
      project,
      "task-1",
      (labels) => [
        ...labels,
        {
          id: "label-bug",
          name: "bug",
          color: "red",
        },
      ],
    );

    expect(updatedProject.columns[0]?.tasks[0]?.labels).toEqual([
      {
        id: "label-bug",
        name: "bug",
        color: "red",
      },
    ]);
    expect(updatedProject.columns[0]?.tasks[1]?.labels).toEqual([]);
  });

  it("removes a label from planned and archived task collections too", () => {
    const project = {
      id: "project-1",
      name: "Project",
      slug: "PROJ",
      icon: null,
      description: null,
      isPublic: false,
      createdAt: "2026-04-16T00:00:00.000Z",
      updatedAt: "2026-04-16T00:00:00.000Z",
      workspaceId: "workspace-1",
      columns: [],
      plannedTasks: [
        {
          id: "task-3",
          title: "Planned task",
          number: 3,
          description: null,
          status: "planned",
          priority: null,
          startDate: null,
          dueDate: null,
          position: 0,
          createdAt: "2026-04-16T00:00:00.000Z",
          updatedAt: "2026-04-16T00:00:00.000Z",
          userId: null,
          assigneeId: null,
          assigneeName: null,
          assigneeImage: null,
          projectId: "project-1",
          labels: [
            {
              id: "label-bug",
              name: "bug",
              color: "red",
            },
          ],
          externalLinks: [],
        },
      ],
      archivedTasks: [
        {
          id: "task-4",
          title: "Archived task",
          number: 4,
          description: null,
          status: "archived",
          priority: null,
          startDate: null,
          dueDate: null,
          position: 0,
          createdAt: "2026-04-16T00:00:00.000Z",
          updatedAt: "2026-04-16T00:00:00.000Z",
          userId: null,
          assigneeId: null,
          assigneeName: null,
          assigneeImage: null,
          projectId: "project-1",
          labels: [
            {
              id: "label-bug",
              name: "bug",
              color: "red",
            },
          ],
          externalLinks: [],
        },
      ],
    };

    const updatedProject = updateTaskLabelsInProject(
      project,
      "task-3",
      (labels) => labels.filter((label) => label.id !== "label-bug"),
    );

    expect(updatedProject.plannedTasks[0]?.labels).toEqual([]);
    expect(updatedProject.archivedTasks[0]?.labels).toEqual([
      {
        id: "label-bug",
        name: "bug",
        color: "red",
      },
    ]);
  });
});

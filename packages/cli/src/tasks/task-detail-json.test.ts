import { describe, expect, it } from "vite-plus/test";
import type { Column, Project, TaskDetail } from "../api/schemas.js";
import { toTaskDetailJson } from "./task-detail-json.js";

const task: TaskDetail = {
  id: "task-1",
  projectId: "project-1",
  number: 12,
  title: "Fix login redirect",
  description: "Steps",
  status: "in-progress",
  priority: "high",
  startDate: null,
  dueDate: "2026-10-08T10:00:00.000Z",
  createdAt: "2026-10-01T10:00:00.000Z",
  assigneeId: "user-1",
  assigneeName: "Ada Lovelace",
};

const project: Project = {
  id: "project-1",
  workspaceId: "workspace-1",
  slug: "kan",
  name: "Kaneo Web",
  icon: null,
  description: null,
  archivedAt: null,
  position: 0,
  lastTaskNumber: 12,
};

const column: Column = {
  id: "column-1",
  projectId: "project-1",
  name: "In Progress",
  slug: "in-progress",
  position: 1,
  color: null,
  isFinal: false,
};

describe("toTaskDetailJson", () => {
  it("flattens the task, project and column", () => {
    expect(
      toTaskDetailJson({
        task,
        project,
        columns: [column],
        workspaceId: "workspace-1",
        ticketId: "KAN-12",
        url: "https://kaneo.test/task-1",
      }),
    ).toEqual({
      id: "task-1",
      ticketId: "KAN-12",
      number: 12,
      title: "Fix login redirect",
      description: "Steps",
      status: "in-progress",
      statusName: "In Progress",
      priority: "high",
      assignee: { id: "user-1", name: "Ada Lovelace" },
      dueDate: "2026-10-08T10:00:00.000Z",
      startDate: null,
      createdAt: "2026-10-01T10:00:00.000Z",
      projectId: "project-1",
      projectKey: "KAN",
      projectName: "Kaneo Web",
      workspaceId: "workspace-1",
      url: "https://kaneo.test/task-1",
    });
  });

  it("falls back to the slug without a matching column and to null without an assignee", () => {
    const json = toTaskDetailJson({
      task: {
        ...task,
        assigneeId: null,
        assigneeName: null,
        status: "planned",
      },
      project,
      columns: [column],
      workspaceId: "workspace-1",
      ticketId: null,
      url: "https://kaneo.test/task-1",
    });
    expect(json.statusName).toBe("planned");
    expect(json.assignee).toBeNull();
    expect(json.ticketId).toBeNull();
  });
});

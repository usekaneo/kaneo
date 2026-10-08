import { describe, expect, it } from "vite-plus/test";
import {
  INTERNAL_EVENT_NAMES,
  mapInternalEvent,
} from "../../../apps/api/src/plugin-host/events/map-internal-event";

const common = { taskId: "task-1", projectId: "project-1", userId: "user-1" };

describe("mapInternalEvent", () => {
  it("subscribes to the internal events behind the SDK catalog", () => {
    expect([...INTERNAL_EVENT_NAMES].sort()).toEqual(
      [
        "comment.created",
        "task.assignee_changed",
        "task.created",
        "task.deleted",
        "task.description_changed",
        "task.due_date_changed",
        "task.moved",
        "task.priority_changed",
        "task.status_changed",
        "task.title_changed",
        "task.unassigned",
      ].sort(),
    );
  });

  it("maps task.created with the acting user, not the assignee", () => {
    expect(
      mapInternalEvent("task.created", {
        id: "task-1",
        taskId: "task-1",
        projectId: "project-1",
        userId: "assignee-1",
        currentUserId: "creator-1",
        title: "Write docs",
        status: "to-do",
        priority: "high",
        number: 7,
        type: "created",
      }),
    ).toEqual({
      type: "task.created",
      taskId: "task-1",
      projectId: "project-1",
      actorId: "creator-1",
      title: "Write docs",
      status: "to-do",
      priority: "high",
      number: 7,
    });
  });

  it("treats integration-created tasks as having no actor", () => {
    expect(
      mapInternalEvent("task.created", {
        id: "task-1",
        taskId: "task-1",
        projectId: "project-1",
        userId: "",
        title: "From GitHub",
        status: "to-do",
        priority: "low",
        number: null,
      }),
    ).toMatchObject({ actorId: null, number: null });
  });

  it("maps status, priority and title changes to from and to", () => {
    expect(
      mapInternalEvent("task.status_changed", {
        ...common,
        oldStatus: "to-do",
        newStatus: "done",
        title: "Task",
        assigneeId: "user-2",
        type: "status_changed",
      }),
    ).toEqual({
      type: "task.status_changed",
      taskId: "task-1",
      projectId: "project-1",
      actorId: "user-1",
      from: "to-do",
      to: "done",
    });
    expect(
      mapInternalEvent("task.priority_changed", {
        ...common,
        oldPriority: "low",
        newPriority: "urgent",
      }),
    ).toMatchObject({
      type: "task.priority_changed",
      from: "low",
      to: "urgent",
    });
    expect(
      mapInternalEvent("task.title_changed", {
        ...common,
        oldTitle: "Old",
        newTitle: "New",
      }),
    ).toMatchObject({ type: "task.title_changed", from: "Old", to: "New" });
  });

  it("treats an empty or missing user as no actor", () => {
    expect(
      mapInternalEvent("task.status_changed", {
        ...common,
        userId: null,
        oldStatus: "to-do",
        newStatus: "done",
      }),
    ).toMatchObject({ actorId: null });
    expect(
      mapInternalEvent("task.description_changed", { ...common, userId: "" }),
    ).toEqual({
      type: "task.description_changed",
      taskId: "task-1",
      projectId: "project-1",
      actorId: null,
    });
  });

  it("maps due dates to ISO strings or null", () => {
    expect(
      mapInternalEvent("task.due_date_changed", {
        ...common,
        oldDueDate: null,
        newDueDate: new Date("2026-10-07T12:00:00.000Z"),
      }),
    ).toMatchObject({ from: null, to: "2026-10-07T12:00:00.000Z" });
    expect(
      mapInternalEvent("task.due_date_changed", {
        ...common,
        oldDueDate: "2026-10-01T00:00:00.000Z",
        newDueDate: undefined,
      }),
    ).toMatchObject({ from: "2026-10-01T00:00:00.000Z", to: null });
  });

  it("maps assignment and unassignment to task.assignee_changed", () => {
    expect(
      mapInternalEvent("task.assignee_changed", {
        ...common,
        oldAssignee: "user-2",
        newAssignee: "Alice",
        newAssigneeId: "user-3",
      }),
    ).toMatchObject({
      type: "task.assignee_changed",
      from: "user-2",
      to: "user-3",
    });
    expect(
      mapInternalEvent("task.assignee_changed", {
        ...common,
        oldAssignee: undefined,
        newAssigneeId: "user-3",
      }),
    ).toMatchObject({ from: null, to: "user-3" });
    expect(
      mapInternalEvent("task.unassigned", {
        ...common,
        oldAssignee: "user-2",
        newAssignee: undefined,
        newAssigneeId: null,
      }),
    ).toMatchObject({
      type: "task.assignee_changed",
      from: "user-2",
      to: null,
    });
  });

  it("maps task.moved to the destination project", () => {
    expect(
      mapInternalEvent("task.moved", {
        taskId: "task-1",
        userId: "user-1",
        fromProjectId: "project-1",
        fromProjectName: "One",
        toProjectId: "project-2",
        toProjectName: "Two",
      }),
    ).toEqual({
      type: "task.moved",
      taskId: "task-1",
      projectId: "project-2",
      actorId: "user-1",
      fromProjectId: "project-1",
      toProjectId: "project-2",
    });
  });

  it("maps task.deleted with its title", () => {
    expect(
      mapInternalEvent("task.deleted", { ...common, title: "Gone" }),
    ).toMatchObject({ type: "task.deleted", title: "Gone" });
  });

  it("maps comment.created from the activity row", () => {
    expect(
      mapInternalEvent("comment.created", {
        id: "activity-1",
        taskId: "task-1",
        type: "comment",
        userId: "user-1",
        content: "Looks good",
        comment: "**Alice** commented:\n> Looks good",
        projectId: "project-1",
        initiatorId: "user-1",
      }),
    ).toEqual({
      type: "comment.created",
      taskId: "task-1",
      projectId: "project-1",
      actorId: "user-1",
      commentId: "activity-1",
      content: "Looks good",
    });
  });

  it("drops malformed or unknown events", () => {
    expect(mapInternalEvent("task.updated", common)).toBeNull();
    expect(mapInternalEvent("task.deleted", { taskId: "task-1" })).toBeNull();
    expect(mapInternalEvent("task.status_changed", common)).toBeNull();
    expect(mapInternalEvent("task.created", null)).toBeNull();
  });
});

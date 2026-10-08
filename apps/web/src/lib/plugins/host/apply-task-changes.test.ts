import { describe, expect, it } from "vite-plus/test";
import type Task from "@/types/task";
import { applyTaskChanges } from "./apply-task-changes";

const task: Task = {
  id: "t1",
  title: "Ship plugins",
  number: 7,
  description: null,
  descriptionDeferred: true,
  status: "to-do",
  priority: "high",
  startDate: "2026-10-01T00:00:00.000Z",
  dueDate: "2026-10-03T00:00:00.000Z",
  position: 2,
  createdAt: "2026-09-30T00:00:00.000Z",
  userId: "u1",
  assigneeId: "u1",
  assigneeName: "Ada",
  projectId: "p1",
};

describe("applyTaskChanges", () => {
  it("keeps every field the plugin did not change", () => {
    expect(applyTaskChanges(task, {})).toEqual(task);
    expect(applyTaskChanges(task, {})).not.toBe(task);
  });

  it("reschedules a task and clears dates with null", () => {
    expect(
      applyTaskChanges(task, {
        startDate: "2026-10-05T00:00:00.000Z",
        dueDate: null,
      }),
    ).toEqual({
      ...task,
      startDate: "2026-10-05T00:00:00.000Z",
      dueDate: null,
    });
  });

  it("assigns through the field the update endpoint reads", () => {
    expect(applyTaskChanges(task, { assigneeId: "u2" })).toMatchObject({
      userId: "u2",
      assigneeId: "u2",
    });
    expect(applyTaskChanges(task, { assigneeId: null })).toMatchObject({
      userId: null,
      assigneeId: null,
    });
  });

  it("sends a changed description even when the cached one was deferred", () => {
    expect(
      applyTaskChanges(task, {
        title: "Ship it",
        description: "Notes",
        status: "done",
        priority: "low",
      }),
    ).toMatchObject({
      title: "Ship it",
      description: "Notes",
      descriptionDeferred: false,
      status: "done",
      priority: "low",
    });
  });
});

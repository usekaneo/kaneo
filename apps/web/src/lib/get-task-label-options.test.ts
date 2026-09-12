import { describe, expect, it } from "vitest";
import { getTaskLabelOptions } from "./get-task-label-options";

describe("getTaskLabelOptions", () => {
  it("excludes labels assigned to other tasks", () => {
    const labels = [
      { id: "workspace", name: "Bug", taskId: null },
      { id: "current", name: "Imported", taskId: "task-1" },
      { id: "other", name: "Other", taskId: "task-2" },
    ];

    const options = getTaskLabelOptions(labels, "task-1");

    expect(options.map((label) => label.id)).toEqual(["workspace", "current"]);
  });

  it("prefers a workspace label over a task-scoped copy", () => {
    const labels = [
      { id: "task-copy", name: "Bug", taskId: "task-1" },
      { id: "workspace", name: "Bug", taskId: null },
    ];

    const options = getTaskLabelOptions(labels, "task-1");

    expect(options).toEqual([{ id: "workspace", name: "Bug", taskId: null }]);
  });
});

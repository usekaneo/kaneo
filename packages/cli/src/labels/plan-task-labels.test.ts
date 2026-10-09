import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { describeLabelChanges, planTaskLabels } from "./plan-task-labels.js";
import { taskLabel, workspaceLabel } from "./test-labels.js";

const bug = workspaceLabel("l_bug", "Bug");
const docsCopy = taskLabel("c_docs", "Docs", "t1");
const bugCopy = taskLabel("c_bug", "Bug", "t1");

describe("planTaskLabels", () => {
  it("removes the task copies by name", () => {
    expect(
      planTaskLabels({
        taskRef: "KAN-1",
        taskLabels: [docsCopy],
        add: [bug],
        removeNames: ["docs", "Docs"],
      }),
    ).toEqual(Result.succeed({ add: [bug], remove: [docsCopy] }));
  });

  it("fails when the task does not have the label", () => {
    const result = planTaskLabels({
      taskRef: "KAN-1",
      taskLabels: [docsCopy],
      add: [],
      removeNames: ["Bug"],
    });
    expect(Result.isFailure(result) && result.failure.message).toBe(
      'KAN-1 has no label named "Bug".',
    );
    expect(Result.isFailure(result) && result.failure.hint).toBe(
      "Its labels: Docs.",
    );
  });

  it("refuses to add and remove the same label", () => {
    const result = planTaskLabels({
      taskRef: "KAN-1",
      taskLabels: [bugCopy],
      add: [bug],
      removeNames: ["bug"],
    });
    expect(Result.isFailure(result) && result.failure.message).toBe(
      "Bug is both added and removed.",
    );
  });
});

describe("describeLabelChanges", () => {
  it("lists additions then removals", () => {
    expect(describeLabelChanges({ add: [bug], remove: [docsCopy] })).toBe(
      "labels +Bug -Docs",
    );
    expect(describeLabelChanges({ add: [], remove: [] })).toBeNull();
  });
});

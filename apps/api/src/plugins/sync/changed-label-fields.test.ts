import { expect, it } from "vite-plus/test";
import { changedLabelFields } from "./changed-label-fields";

const task = { status: "to-do", priority: "low" };

it("ignores labels Kaneo already accounted for", () => {
  const known = ["status:in-review", "priority:high"];
  expect(changedLabelFields(known, known, task)).toEqual({
    status: undefined,
    priority: undefined,
  });
});

it("applies only labels added since then, per field", () => {
  expect(
    changedLabelFields(
      ["priority:low", "status:to-do", "status:in-review"],
      ["priority:low", "status:to-do"],
      task,
    ),
  ).toEqual({ status: "in-review", priority: undefined });
  expect(
    changedLabelFields(
      ["priority:high", "status:to-do"],
      ["priority:low", "status:to-do"],
      { status: "done", priority: "low" },
    ),
  ).toEqual({ status: undefined, priority: "high" });
});

it("ignores removals and values the task already has", () => {
  expect(
    changedLabelFields(["status:to-do"], ["status:in-review"], task),
  ).toEqual({ status: undefined, priority: undefined });
  expect(changedLabelFields([], ["status:to-do"], task)).toEqual({
    status: undefined,
    priority: undefined,
  });
});

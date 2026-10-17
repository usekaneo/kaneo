import { expect, it } from "vite-plus/test";
import { changedLabelFields } from "./changed-label-fields";

const link = { id: "link", metadata: null };
const task = { status: "to-do", priority: "low" };

it("ignores labels already confirmed on the provider", () => {
  const known = ["status:to-do", "priority:low"];
  expect(changedLabelFields(link, known, known, task)).toEqual({
    status: undefined,
    priority: undefined,
  });
  expect(
    changedLabelFields(link, ["status:in-review"], ["status:in-review"], task),
  ).toEqual({ status: undefined, priority: undefined });
});

it("applies only labels added since the last confirmation", () => {
  expect(
    changedLabelFields(
      link,
      ["priority:low", "status:to-do", "status:in-review"],
      ["priority:low", "status:to-do"],
      task,
    ),
  ).toEqual({ status: "in-review", priority: undefined });
  expect(
    changedLabelFields(
      link,
      ["priority:high", "status:to-do"],
      ["priority:low", "status:to-do"],
      { status: "done", priority: "low" },
    ),
  ).toEqual({ status: undefined, priority: "high" });
});

it("falls back to the task value without a confirmation", () => {
  expect(
    changedLabelFields(
      link,
      ["status:to-do", "status:in-review"],
      undefined,
      task,
    ),
  ).toEqual({ status: "in-review", priority: undefined });
});

it("keeps fields unchanged since a resume", () => {
  const resumed = {
    id: "link",
    metadata: JSON.stringify({ syncResumeLabelBaseline: ["status:to-do"] }),
  };
  expect(
    changedLabelFields(resumed, ["status:to-do"], undefined, {
      status: "planned",
      priority: null,
    }),
  ).toEqual({ status: undefined, priority: undefined });
});

import { describe, expect, it } from "vite-plus/test";
import { getCalendarLabelOptions } from "./get-calendar-label-options";

describe("getCalendarLabelOptions", () => {
  it("keeps one option per name, preferring the workspace definition", () => {
    expect(
      getCalendarLabelOptions([
        { id: "copy", name: "Release", color: "red", taskId: "task-1" },
        { id: "release", name: "Release", color: "red", taskId: null },
        { id: "later-copy", name: "Release", color: "red", taskId: "task-2" },
      ]),
    ).toEqual([{ value: "release", label: "Release", color: "red" }]);
  });

  it("falls back to a task copy when no definition exists and sorts by name", () => {
    expect(
      getCalendarLabelOptions([
        { id: "zeta", name: "Zeta", color: "gray", taskId: null },
        { id: "alpha-copy", name: "Alpha", color: "teal", taskId: "task-1" },
      ]),
    ).toEqual([
      { value: "alpha-copy", label: "Alpha", color: "teal" },
      { value: "zeta", label: "Zeta", color: "gray" },
    ]);
  });
});

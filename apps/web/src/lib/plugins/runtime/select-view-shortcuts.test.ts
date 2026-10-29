import { describe, expect, it } from "vite-plus/test";
import { selectViewShortcuts } from "./select-view-shortcuts";

const view = (pluginId: string, viewId: string, shortcut?: unknown) => ({
  pluginId,
  viewId,
  title: viewId,
  shortcut,
});

describe("selectViewShortcuts", () => {
  it("maps plugin view shortcuts to lowercase keys", () => {
    expect(
      selectViewShortcuts(
        [view("gantt", "timeline", "G"), view("reports", "chart", " r ")],
        ["b"],
      ),
    ).toEqual([
      { pluginId: "gantt", viewId: "timeline", title: "timeline", key: "g" },
      { pluginId: "reports", viewId: "chart", title: "chart", key: "r" },
    ]);
  });

  it("lets built-in view keys and earlier plugins win", () => {
    expect(
      selectViewShortcuts(
        [
          view("board-clone", "board", "b"),
          view("gantt", "timeline", "g"),
          view("other-gantt", "timeline", "g"),
        ],
        ["b", "C", "l", "k"],
      ),
    ).toEqual([
      { pluginId: "gantt", viewId: "timeline", title: "timeline", key: "g" },
    ]);
  });

  it("ignores missing and unusable shortcuts", () => {
    expect(
      selectViewShortcuts(
        [
          view("a", "x"),
          view("b", "x", ""),
          view("c", "x", "gg"),
          view("d", "x", "?"),
          view("e", "x", 7),
        ],
        [],
      ),
    ).toEqual([]);
  });
});

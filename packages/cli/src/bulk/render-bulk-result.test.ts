import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import { bulkHeadline, renderBulkResult } from "./render-bulk-result.js";

const ui = makeUi({
  color: 0,
  unicode: true,
  hyperlinks: false,
  animate: false,
  columns: 80,
});

const tasks = [
  { label: "KAN-1", title: "Fix login redirect", url: "https://kaneo.test/1" },
  {
    label: "KAN-12",
    title:
      "A title long enough to need shortening on an eighty column terminal",
    url: "https://kaneo.test/12",
  },
];

describe("bulkHeadline", () => {
  it("describes each change", () => {
    expect(
      bulkHeadline({ kind: "status", columnName: "Done" }, 2, 2).text,
    ).toBe("Moved 2 tasks to Done");
    expect(
      bulkHeadline({ kind: "priority", priority: "high" }, 1, 1).text,
    ).toBe("Set priority to High on 1 task");
    expect(
      bulkHeadline({ kind: "priority", priority: "no-priority" }, 2, 2).text,
    ).toBe("Cleared the priority on 2 tasks");
    expect(bulkHeadline({ kind: "assignee", name: "Ada" }, 2, 2).text).toBe(
      "Assigned 2 tasks to Ada",
    );
    expect(bulkHeadline({ kind: "unassign" }, 2, 2).text).toBe(
      "Unassigned 2 tasks",
    );
    expect(bulkHeadline({ kind: "due", dueDate: null }, 2, 2).text).toBe(
      "Cleared the due date on 2 tasks",
    );
    expect(
      bulkHeadline({ kind: "due", dueDate: "2026-10-20T10:00:00.000Z" }, 2, 2)
        .text,
    ).toBe("Set the due date to Oct 20, 2026 on 2 tasks");
    expect(bulkHeadline({ kind: "delete" }, 3, 3).text).toBe("Deleted 3 tasks");
  });

  it("counts label changes that did not apply", () => {
    expect(bulkHeadline({ kind: "addLabel", labelName: "Bug" }, 3, 2)).toEqual({
      text: "Added Bug to 2 tasks",
      aside: "1 already had it",
    });
    expect(
      bulkHeadline({ kind: "removeLabel", labelName: "Bug" }, 3, 1),
    ).toEqual({ text: "Removed Bug from 1 task", aside: "2 did not have it" });
    expect(
      bulkHeadline({ kind: "addLabel", labelName: "Bug" }, 2, 0).text,
    ).toBe("No change: all 2 tasks already had Bug");
    expect(
      bulkHeadline({ kind: "removeLabel", labelName: "Bug" }, 1, 0).text,
    ).toBe("No change: the task did not have Bug");
  });
});

describe("renderBulkResult", () => {
  it("prints the summary and the tickets at 80 columns", () => {
    const lines = renderBulkResult(ui, {
      change: { kind: "addLabel", labelName: "Bug" },
      updated: 1,
      tasks,
    });
    expect(lines).toEqual([
      "",
      "  ✓ Added Bug to 1 task (1 already had it)",
      "",
      "    KAN-1   Fix login redirect",
      "    KAN-12  A title long enough to need shortening on an eighty column terminal",
      "",
    ]);
    for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(80);
  });

  it("truncates titles on narrow terminals", () => {
    const narrow = makeUi({ ...ui.caps, columns: 40 });
    const lines = renderBulkResult(narrow, {
      change: { kind: "delete" },
      updated: 2,
      tasks,
    });
    expect(lines[4]).toBe("    KAN-12  A title long enough to need…");
  });
});

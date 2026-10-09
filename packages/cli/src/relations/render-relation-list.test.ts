import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import type { RelatedTaskJson } from "./group-relations.js";
import { renderRelationList } from "./render-relation-list.js";

const ui = (columns: number) =>
  makeUi({
    color: 0,
    unicode: true,
    hyperlinks: false,
    animate: false,
    columns,
  });

const task = (
  ticketId: string,
  title: string,
  status = "to-do",
  completed = false,
): RelatedTaskJson => ({
  id: ticketId.toLowerCase(),
  ticketId,
  title,
  status,
  completed,
  url: `https://kaneo.test/${ticketId}`,
});

const view = {
  label: "KAN-3",
  title: "Fix login redirect",
  url: "https://kaneo.test/KAN-3",
};

describe("renderRelationList", () => {
  it("groups the parent, subtasks and other relations", () => {
    expect(
      renderRelationList(ui(80), {
        ...view,
        relations: {
          parent: task("KAN-1", "Auth overhaul", "in-progress"),
          subtasks: [
            task("KAN-4", "Write tests", "done", true),
            task("KAN-10", "Update docs"),
          ],
          relations: [
            {
              type: "blocks",
              direction: "outgoing",
              task: task("KAN-7", "Release 2.0"),
            },
            {
              type: "blocked-by",
              direction: "incoming",
              task: task("MOB-2", "API change", "in-review"),
            },
            {
              type: "relates-to",
              direction: "incoming",
              task: task("KAN-6", "Session timeout"),
            },
          ],
        },
      }),
    ).toEqual([
      "",
      "  KAN-3 Fix login redirect · Relations",
      "",
      "  Parent",
      "    ● KAN-1   Auth overhaul    In Progress",
      "",
      "  Subtasks 1 of 2 done",
      "    ● KAN-4   Write tests      Done",
      "    ● KAN-10  Update docs      To Do",
      "",
      "  Blocks",
      "    ● KAN-7   Release 2.0      To Do",
      "",
      "  Blocked by",
      "    ● MOB-2   API change       In Review",
      "",
      "  Related",
      "    ● KAN-6   Session timeout  To Do",
      "",
    ]);
  });

  it("fits long titles to the terminal width", () => {
    const lines = renderRelationList(ui(80), {
      ...view,
      relations: {
        parent: null,
        subtasks: [task("KAN-4", "A".repeat(120))],
        relations: [],
      },
    });
    for (const line of lines) expect(stringWidth(line)).toBeLessThanOrEqual(80);
    expect(lines[4]).toContain("…");
  });

  it("explains how to link when there is nothing", () => {
    expect(
      renderRelationList(ui(80), {
        ...view,
        relations: { parent: null, subtasks: [], relations: [] },
      }),
    ).toEqual([
      "",
      "  KAN-3 Fix login redirect · Relations",
      "",
      "  No linked tasks. Link one with kaneo task relation add KAN-3 <type> <task>",
      "",
    ]);
  });
});

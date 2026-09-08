import { describe, expect, it } from "vitest";
import { getTaskItemStats } from "./get-task-item-stats";

describe("getTaskItemStats", () => {
  it("returns zeroes for an empty description", () => {
    expect(getTaskItemStats(null)).toEqual({ total: 0, completed: 0 });
    expect(getTaskItemStats("")).toEqual({ total: 0, completed: 0 });
  });

  it("counts checked and unchecked Markdown task-list items", () => {
    expect(
      getTaskItemStats("- [ ] Plan\n- [x] Build\n  - [X] Review\n- [ ] Ship"),
    ).toEqual({ total: 4, completed: 2 });
  });

  it("does not count ordinary lists or checkbox syntax outside a list item", () => {
    expect(
      getTaskItemStats(
        "- Plain bullet\n[ ] Not a task item\n1. [x] Ordered item",
      ),
    ).toEqual({ total: 1, completed: 1 });
  });

  it("does not count Markdown examples in fenced code blocks", () => {
    expect(
      getTaskItemStats(
        "- [x] Real item\n```md\n- [ ] Example\n```\n- [ ] Another item",
      ),
    ).toEqual({ total: 2, completed: 1 });
  });

  it("does not count task items in blockquoted fenced code blocks", () => {
    expect(
      getTaskItemStats("> ```md\n> - [ ] Example\n> ```\n> - [x] Real item"),
    ).toEqual({ total: 1, completed: 1 });
  });

  it("supports blockquoted task-list items", () => {
    expect(getTaskItemStats("> - [x] Quoted item")).toEqual({
      total: 1,
      completed: 1,
    });
  });

  it.each(["```", "~~~"])(
    "keeps a %s fence open when a marker has trailing content",
    (marker) => {
      const description = `${marker}\n${marker}ts\n- [x] Example\n${marker} \t\n- [ ] Real item`;

      const stats = getTaskItemStats(description);

      expect(stats).toEqual({ total: 1, completed: 0 });
    },
  );
});

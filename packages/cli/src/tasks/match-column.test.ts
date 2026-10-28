import { describe, expect, it } from "vite-plus/test";
import { matchColumn } from "./match-column.js";

const columns = [
  { id: "c1", slug: "to-do", name: "To Do" },
  { id: "c2", slug: "in-progress", name: "In Progress" },
  { id: "c3", slug: "in-review", name: "In Review" },
  { id: "c4", slug: "done", name: "Done" },
];

const slugOf = (reference: string) => matchColumn(columns, reference)?.slug;

describe("matchColumn", () => {
  it("matches the slug in any case", () => {
    expect(slugOf("in-progress")).toBe("in-progress");
    expect(slugOf("IN-PROGRESS")).toBe("in-progress");
  });

  it("matches the column id", () => {
    expect(slugOf("c3")).toBe("in-review");
  });

  it("matches the name in any case", () => {
    expect(slugOf("in review")).toBe("in-review");
    expect(slugOf("  Done ")).toBe("done");
  });

  it("ignores spaces, dashes and underscores", () => {
    expect(slugOf("todo")).toBe("to-do");
    expect(slugOf("to_do")).toBe("to-do");
    expect(slugOf("InProgress")).toBe("in-progress");
  });

  it("accepts common aliases", () => {
    expect(slugOf("doing")).toBe("in-progress");
    expect(slugOf("wip")).toBe("in-progress");
    expect(slugOf("review")).toBe("in-review");
    expect(slugOf("completed")).toBe("done");
  });

  it("prefers a real column over an alias", () => {
    const custom = [...columns, { id: "c5", slug: "doing", name: "Doing" }];
    expect(matchColumn(custom, "doing")?.id).toBe("c5");
  });

  it("rejects aliases that map to more than one column", () => {
    const custom = [
      { slug: "in-progress", name: "In Progress" },
      { slug: "wip", name: "In progress" },
    ];
    expect(matchColumn(custom, "doing")).toBeUndefined();
  });

  it("rejects loose matches that hit more than one column", () => {
    const custom = [
      { slug: "todo", name: "Later" },
      { slug: "to-do-now", name: "To Do" },
    ];
    expect(matchColumn(custom, "to do")?.slug).toBe("to-do-now");
    expect(matchColumn(custom, "to_do")).toBeUndefined();
  });

  it("returns nothing for unknown or empty input", () => {
    expect(slugOf("shipped")).toBeUndefined();
    expect(slugOf("  ")).toBeUndefined();
    expect(slugOf("-")).toBeUndefined();
  });
});

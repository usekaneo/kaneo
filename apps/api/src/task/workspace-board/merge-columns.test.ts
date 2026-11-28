import { describe, expect, it } from "vite-plus/test";
import { mergeColumns } from "./merge-columns";

const column = (
  slug: string,
  name: string,
  position: number,
  extra: { icon?: string | null; isFinal?: boolean } = {},
) => ({
  slug,
  name,
  position,
  icon: extra.icon ?? null,
  isFinal: extra.isFinal ?? false,
});

describe("mergeColumns", () => {
  it("merges columns with the same slug into one lane", () => {
    const lanes = mergeColumns([
      column("to-do", "To Do", 0),
      column("to-do", "To Do", 0),
      column("done", "Done", 1, { isFinal: true }),
    ]);

    expect(lanes.map((lane) => lane.slug)).toEqual(["to-do", "done"]);
  });

  it("names a lane after the most common column name", () => {
    const lanes = mergeColumns([
      column("to-do", "Backlog", 0),
      column("to-do", "To Do", 0),
      column("to-do", "To Do", 0),
    ]);

    expect(lanes[0]?.name).toBe("To Do");
  });

  it("keeps the first name when names are tied", () => {
    const lanes = mergeColumns([
      column("to-do", "Backlog", 0),
      column("to-do", "To Do", 0),
    ]);

    expect(lanes[0]?.name).toBe("Backlog");
  });

  it("orders lanes by their earliest position, then by slug", () => {
    const lanes = mergeColumns([
      column("review", "Review", 2),
      column("blocked", "Blocked", 2),
      column("review", "Review", 1),
      column("to-do", "To Do", 0),
    ]);

    expect(lanes.map((lane) => lane.slug)).toEqual([
      "to-do",
      "review",
      "blocked",
    ]);
  });

  it("takes the first icon and marks a lane final when any project does", () => {
    const lanes = mergeColumns([
      column("done", "Done", 0),
      column("done", "Done", 0, { icon: "check", isFinal: true }),
    ]);

    expect(lanes[0]).toEqual({
      slug: "done",
      name: "Done",
      icon: "check",
      isFinal: true,
    });
  });

  it("appends one open lane per status without a column", () => {
    const lanes = mergeColumns(
      [column("to-do", "To Do", 0)],
      ["to-do", "legacy", "legacy"],
    );

    expect(lanes).toEqual([
      { slug: "to-do", name: "To Do", icon: null, isFinal: false },
      { slug: "legacy", name: "legacy", icon: null, isFinal: false },
    ]);
  });
});

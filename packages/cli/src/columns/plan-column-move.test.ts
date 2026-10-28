import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { planColumnMove } from "./plan-column-move.js";

const columns = [
  { id: "c1", slug: "to-do", name: "To Do" },
  { id: "c2", slug: "in-progress", name: "In Progress" },
  { id: "c3", slug: "in-review", name: "In Review" },
  { id: "c4", slug: "done", name: "Done" },
];

const order = (request: {
  column: string;
  before?: string;
  after?: string;
}) => {
  const result = planColumnMove(columns, {
    column: request.column,
    before: request.before,
    after: request.after,
  });
  return Result.isSuccess(result)
    ? result.success.order.map((column) => column.slug)
    : result.failure.message;
};

describe("planColumnMove", () => {
  it("moves a column before another", () => {
    expect(order({ column: "done", before: "in-progress" })).toEqual([
      "to-do",
      "done",
      "in-progress",
      "in-review",
    ]);
  });

  it("moves a column after another, including to the end", () => {
    expect(order({ column: "to-do", after: "in-review" })).toEqual([
      "in-progress",
      "in-review",
      "to-do",
      "done",
    ]);
    expect(order({ column: "to-do", after: "done" })).toEqual([
      "in-progress",
      "in-review",
      "done",
      "to-do",
    ]);
  });

  it("reports when nothing changes", () => {
    const result = planColumnMove(columns, {
      column: "in-progress",
      before: "in-review",
      after: undefined,
    });
    expect(Result.isSuccess(result) && result.success.changed).toBe(false);
  });

  it("needs exactly one placement", () => {
    expect(order({ column: "done" })).toBe("Say where the column goes.");
    expect(order({ column: "done", before: "to-do", after: "to-do" })).toBe(
      "Say where the column goes.",
    );
  });

  it("refuses to move a column relative to itself", () => {
    expect(order({ column: "done", after: "Done" })).toBe(
      "Cannot move Done after itself.",
    );
  });

  it("names the flag of an unknown anchor", () => {
    expect(order({ column: "done", before: "qa" })).toBe(
      '--before "qa" does not match a column in this project.',
    );
    expect(order({ column: "qa", before: "done" })).toBe(
      '"qa" does not match a column in this project.',
    );
  });
});

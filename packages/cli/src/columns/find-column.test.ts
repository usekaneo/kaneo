import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { findColumn } from "./find-column.js";

const columns = [
  { id: "c1", slug: "to-do", name: "To Do" },
  { id: "c2", slug: "in-progress", name: "In Progress" },
  { id: "c3", slug: "done", name: "Done" },
];

describe("findColumn", () => {
  it("matches ids, slugs and names", () => {
    const id = (reference: string) => {
      const result = findColumn(columns, reference);
      return Result.isSuccess(result) ? result.success.id : null;
    };
    expect(id("c2")).toBe("c2");
    expect(id("done")).toBe("c3");
    expect(id("in progress")).toBe("c2");
  });

  it("lists the slugs when nothing matches", () => {
    const result = findColumn(columns, "qa", "--before");
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure.message).toBe(
        '--before "qa" does not match a column in this project.',
      );
      expect(result.failure.hint).toBe("Columns: to-do, in-progress, done.");
    }
  });
});

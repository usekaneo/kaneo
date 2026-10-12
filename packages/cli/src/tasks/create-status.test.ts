import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type { Column } from "../api/schemas.js";
import { createStatus } from "./create-status.js";

const column = (slug: string, name: string, position: number): Column => ({
  id: `column-${slug}`,
  projectId: "project-1",
  slug,
  name,
  position,
  color: null,
  isFinal: slug === "done",
});

const columns = [
  column("done", "Done", 3),
  column("in-progress", "In Progress", 1),
  column("to-do", "To Do", 0),
];

const slugOf = (result: Result.Result<Column | null, unknown>) =>
  Result.isSuccess(result) ? (result.success?.slug ?? null) : "failed";

describe("createStatus", () => {
  it("defaults to the first column by position", () => {
    expect(slugOf(createStatus(columns, undefined, "Kaneo Web"))).toBe("to-do");
  });

  it("has no default without columns", () => {
    expect(slugOf(createStatus([], undefined, "Kaneo Web"))).toBeNull();
  });

  it("matches slugs and names without case", () => {
    expect(slugOf(createStatus(columns, "IN-PROGRESS", "Kaneo Web"))).toBe(
      "in-progress",
    );
    expect(slugOf(createStatus(columns, " in progress ", "Kaneo Web"))).toBe(
      "in-progress",
    );
  });

  it("accepts the same aliases as kaneo task status", () => {
    const result = createStatus(columns, "doing", "Kaneo Web");
    expect(Result.isSuccess(result) && result.success?.slug).toBe(
      "in-progress",
    );
  });

  it("lists the columns when nothing matches", () => {
    const result = createStatus(columns, "blocked", "Kaneo Web");
    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result)) {
      expect(result.failure.message).toBe('Kaneo Web has no column "blocked".');
      expect(result.failure.hint).toBe(
        "Pass -s with one of: to-do, in-progress, done.",
      );
    }
  });
});

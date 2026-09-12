import { describe, expect, it } from "vitest";
import { isPerTaskRelationQuery } from "./relation-query-keys";

const q = (queryKey: readonly unknown[]) => ({ queryKey });

describe("isPerTaskRelationQuery", () => {
  it("matches a per-task relation query", () => {
    expect(isPerTaskRelationQuery(q(["task-relations", "task-1"]))).toBe(true);
  });

  it("excludes the project-scoped query", () => {
    expect(
      isPerTaskRelationQuery(q(["task-relations", "project", "project-1"])),
    ).toBe(false);
  });

  it("ignores unrelated queries", () => {
    expect(isPerTaskRelationQuery(q(["tasks", "project-1"]))).toBe(false);
    expect(isPerTaskRelationQuery(q([]))).toBe(false);
  });
});

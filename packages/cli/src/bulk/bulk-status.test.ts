import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type { Column } from "../api/schemas.js";
import { resolveBulkStatus } from "./bulk-status.js";

function column(slug: string, name: string, position: number): Column {
  return {
    id: `${slug}-id`,
    projectId: "p",
    slug,
    name,
    position,
    color: null,
    isFinal: slug === "done",
  };
}

const standard = [
  column("to-do", "To Do", 0),
  column("in-progress", "In Progress", 1),
  column("done", "Done", 2),
];

describe("resolveBulkStatus", () => {
  it("matches by slug, name or alias in every project", () => {
    const projects = [
      { name: "Kaneo Web", columns: standard },
      { name: "Mobile App", columns: standard },
    ];
    expect(Result.getOrThrow(resolveBulkStatus(projects, "wip")).slug).toBe(
      "in-progress",
    );
    expect(Result.getOrThrow(resolveBulkStatus(projects, "Done")).slug).toBe(
      "done",
    );
  });

  it("names the project without a matching column", () => {
    const result = resolveBulkStatus(
      [
        { name: "Kaneo Web", columns: standard },
        { name: "Mobile App", columns: [column("to-do", "To Do", 0)] },
      ],
      "done",
    );
    expect(Result.isFailure(result) && result.failure.message).toBe(
      'No column in Mobile App matches "done".',
    );
    expect(Result.isFailure(result) && result.failure.hint).toBe(
      "Use one of: to-do.",
    );
  });

  it("refuses a name that means different slugs in different projects", () => {
    const result = resolveBulkStatus(
      [
        { name: "Kaneo Web", columns: standard },
        { name: "Mobile App", columns: [column("shipped", "Done", 0)] },
      ],
      "Done",
    );
    expect(Result.isFailure(result)).toBe(true);
  });
});

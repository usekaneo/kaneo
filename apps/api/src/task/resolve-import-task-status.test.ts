import { describe, expect, it } from "vite-plus/test";
import { resolveImportTaskStatus } from "./resolve-import-task-status";

const columns = [
  { slug: "to-do", name: "Ready to Start" },
  { slug: "done", name: "Fertig ✨" },
];

describe("resolveImportTaskStatus", () => {
  it.each(["Ready to Start", "ready-to-start", " READY TO START "])(
    "resolves the renamed column %s to its stored slug",
    (status) =>
      expect(resolveImportTaskStatus(status, columns)).toEqual({
        status: "to-do",
      }),
  );
  it("preserves stored slugs and virtual statuses", () => {
    for (const status of ["to-do", "done", "planned", "archived"]) {
      expect(resolveImportTaskStatus(status, columns)).toEqual({ status });
    }
  });
  it("supports non-English column names", () => {
    expect(resolveImportTaskStatus("FERTIG", columns)).toEqual({
      status: "done",
    });
  });
  it("prefers an exact slug over another column's display name", () => {
    expect(
      resolveImportTaskStatus("to-do", [
        ...columns,
        { slug: "other", name: "To Do" },
      ]),
    ).toEqual({ status: "to-do" });
  });
  it("rejects ambiguous display names", () => {
    expect(
      resolveImportTaskStatus("ready-to-start", [
        ...columns,
        { slug: "other", name: "Ready to start" },
      ]),
    ).toHaveProperty("error");
  });
  it("retains the warning and backlog fallback for unknown statuses", () => {
    expect(resolveImportTaskStatus("missing", columns)).toEqual({
      status: "planned",
      warning: 'Unknown status "missing" mapped to "planned"',
    });
  });
});

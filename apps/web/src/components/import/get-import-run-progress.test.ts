import { describe, expect, it } from "vite-plus/test";
import {
  getImportRunOutcome,
  getImportRunProgress,
} from "@/components/import/get-import-run-progress";
import type { ImportRun } from "@/fetchers/import/get-import-run";

type Project = Pick<
  ImportRun["projects"][number],
  "name" | "status" | "warnings"
>;

function project(
  name: string,
  status: Project["status"],
  warnings: string[] = [],
): ImportRun["projects"][number] {
  return {
    sourceId: name,
    name,
    status,
    warnings,
    projectId: null,
    projectSlug: null,
    error: null,
    counts: {
      columns: 0,
      tasks: 0,
      labels: 0,
      comments: 0,
      assignees: 0,
      relations: 0,
    },
  };
}

describe("getImportRunProgress", () => {
  it("counts finished projects and points at the one being imported", () => {
    expect(
      getImportRunProgress([
        project("Engineering", "completed", ["a", "b"]),
        project("Design", "running"),
        project("Marketing", "pending"),
      ]),
    ).toEqual({
      total: 3,
      completed: 1,
      failed: 0,
      finished: 1,
      current: 2,
      percent: 33,
      warnings: 2,
      failedNames: [],
    });
  });

  it("names failed projects and never points past the last one", () => {
    const progress = getImportRunProgress([
      project("Engineering", "completed"),
      project("Marketing", "failed", ["ignored"]),
    ]);

    expect(progress.failedNames).toEqual(["Marketing"]);
    expect(progress.current).toBe(2);
    expect(progress.percent).toBe(100);
    expect(progress.warnings).toBe(0);
  });
});

describe("getImportRunOutcome", () => {
  it("is running while the server is still importing", () => {
    expect(
      getImportRunOutcome({
        status: "running",
        projects: [project("A", "completed"), project("B", "running")],
      }),
    ).toBe("running");
  });

  it("is imported when every project made it without warnings", () => {
    expect(
      getImportRunOutcome({
        status: "completed",
        projects: [project("A", "completed"), project("B", "completed")],
      }),
    ).toBe("imported");
  });

  it("reports warnings when every project made it with some", () => {
    expect(
      getImportRunOutcome({
        status: "completed",
        projects: [project("A", "completed", ["x"])],
      }),
    ).toBe("warnings");
  });

  it("is partial when only some projects were imported", () => {
    expect(
      getImportRunOutcome({
        status: "completed",
        projects: [project("A", "completed"), project("B", "failed")],
      }),
    ).toBe("partial");
    expect(
      getImportRunOutcome({
        status: "failed",
        projects: [project("A", "completed")],
      }),
    ).toBe("partial");
  });

  it("failed when nothing was imported", () => {
    expect(
      getImportRunOutcome({
        status: "failed",
        projects: [project("A", "failed"), project("B", "failed")],
      }),
    ).toBe("failed");
  });
});

import { describe, expect, it } from "vite-plus/test";
import { extractTaskIdsFromLinks } from "../../../../../apps/api/src/plugins/github/utils/task-references";

const link = (projectId: string, taskId: string) =>
  `https://kaneo.example.com/dashboard/workspace/ws1/project/${projectId}/task/${taskId}`;

describe("extractTaskIdsFromLinks", () => {
  it("extracts task IDs from links to the project", () => {
    expect(
      extractTaskIdsFromLinks(
        "p1",
        "Title",
        `Implements ${link("p1", "t1")}.\n\nSee (${link("p1", "t2")})`,
      ),
    ).toEqual(["t1", "t2"]);
  });

  it("ignores links to other projects", () => {
    expect(extractTaskIdsFromLinks("p1", link("p2", "t1"))).toEqual([]);
  });

  it("deduplicates and tolerates missing text", () => {
    expect(
      extractTaskIdsFromLinks("p1", link("p1", "t1"), null, link("p1", "t1")),
    ).toEqual(["t1"]);
  });
});

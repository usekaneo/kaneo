import { describe, expect, it } from "vite-plus/test";
import { extractTaskLinks } from "../../../../../apps/api/src/plugins/github/utils/task-references";

const link = (projectId: string, taskId: string) =>
  `https://kaneo.example.com/dashboard/workspace/ws1/project/${projectId}/task/${taskId}`;

describe("extractTaskLinks", () => {
  it("extracts task links from every text", () => {
    expect(
      extractTaskLinks(
        "Title",
        `Implements ${link("p1", "t1")}.\n\nSee (${link("p2", "t2")})`,
      ),
    ).toEqual([
      { projectId: "p1", taskId: "t1" },
      { projectId: "p2", taskId: "t2" },
    ]);
  });

  it("ignores paths that are not task links", () => {
    expect(
      extractTaskLinks(
        "https://example.com/docs/project/p1/task/t1",
        "/workspace/ws1/project/p1/task/t1",
      ),
    ).toEqual([]);
  });

  it("deduplicates and tolerates missing text", () => {
    expect(extractTaskLinks(link("p1", "t1"), null, link("p1", "t1"))).toEqual([
      { projectId: "p1", taskId: "t1" },
    ]);
  });
});

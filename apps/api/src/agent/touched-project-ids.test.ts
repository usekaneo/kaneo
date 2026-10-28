import { describe, expect, it } from "vite-plus/test";
import {
  projectsInMentions,
  projectsInTaskPage,
  splitWorkload,
  uniqueProjectIds,
} from "./touched-project-ids";

describe("touched project ids", () => {
  it("dedupes, sorts, and drops empty ids, keeping the legacy marker", () => {
    expect(uniqueProjectIds(["b", null, "a", undefined, "b", "", "*"])).toEqual(
      ["*", "a", "b"],
    );
  });

  it("records the requested project and every returned task's project", () => {
    expect(projectsInTaskPage("p1", { tasks: [{ projectId: "p2" }] })).toEqual([
      "p1",
      "p2",
    ]);
    expect(
      projectsInTaskPage(null, {
        tasks: [{ projectId: "p2" }, { projectId: "p1" }, { projectId: "p2" }],
      }),
    ).toEqual(["p1", "p2"]);
    expect(projectsInTaskPage(undefined, { tasks: [] })).toEqual([]);
  });

  it("keeps workload counts for the model and the counted projects for the run", () => {
    expect(
      splitWorkload(null, [
        { userId: "u1", openTasks: 2, projectIds: ["p2", "p1"] },
        { userId: null, openTasks: 1, projectIds: ["p1"] },
      ]),
    ).toEqual({
      result: [
        { userId: "u1", openTasks: 2 },
        { userId: null, openTasks: 1 },
      ],
      projectIds: ["p1", "p2"],
    });
    expect(splitWorkload("p3", [])).toEqual({
      result: [],
      projectIds: ["p3"],
    });
  });

  it("uses a mentioned task's project and a mentioned project's own id", () => {
    expect(
      projectsInMentions([
        { type: "project", id: "p1", name: "Launch", key: "LAU" },
        {
          type: "task",
          id: "t1",
          title: "Fix login",
          key: "WEB-1",
          status: "to-do",
          project: "Web",
          projectId: "p2",
        },
      ]),
    ).toEqual(["p1", "p2"]);
  });
});

import { describe, expect, it } from "vite-plus/test";
import type { GlobalBoardProject } from "@/fetchers/task/get-global-board-meta";
import { resolveDropTarget } from "./resolve-drop-target";

const column = (
  slug: string,
  globalStatus: GlobalBoardProject["columns"][number]["globalStatus"],
  position: number,
) => ({
  slug,
  name: slug,
  icon: null,
  isFinal: globalStatus === "done",
  position,
  globalStatus,
});

const project: GlobalBoardProject = {
  id: "p1",
  name: "Web",
  slug: "web",
  icon: null,
  workspaceId: "w1",
  columns: [
    column("to-do", "to-do", 0),
    column("in-progress", "in-progress", 1),
    column("in-review", "in-progress", 2),
    column("done", "done", 3),
    column("completed", null, 4),
  ],
};

describe("resolveDropTarget", () => {
  it("moves to the project's only column for that lane", () => {
    expect(resolveDropTarget(project, "to-do", "done")).toEqual({
      kind: "move",
      column: project.columns[3],
    });
  });

  it("asks which column when several map to the lane", () => {
    expect(resolveDropTarget(project, "to-do", "in-progress")).toEqual({
      kind: "choose",
      columns: [project.columns[1], project.columns[2]],
    });
  });

  it("does nothing when the task already sits in that lane", () => {
    expect(resolveDropTarget(project, "in-review", "in-progress")).toEqual({
      kind: "unchanged",
    });
  });

  it("moves an unmapped task out to a mapped lane", () => {
    expect(resolveDropTarget(project, "completed", "to-do")).toEqual({
      kind: "move",
      column: project.columns[0],
    });
  });

  it("refuses drops it cannot place", () => {
    const noProgress = {
      ...project,
      columns: [column("to-do", "to-do", 0), column("done", "done", 1)],
    };
    expect(resolveDropTarget(noProgress, "to-do", "in-progress")).toEqual({
      kind: "unavailable",
    });
    expect(resolveDropTarget(project, "to-do", "unmapped")).toEqual({
      kind: "unavailable",
    });
    expect(resolveDropTarget(undefined, "to-do", "done")).toEqual({
      kind: "unavailable",
    });
  });

  it("offers a duplicated slug once", () => {
    const duplicated = {
      ...project,
      columns: [
        column("to-do", "to-do", 0),
        column("done", "done", 1),
        column("done", "done", 2),
      ],
    };
    expect(resolveDropTarget(duplicated, "to-do", "done")).toMatchObject({
      kind: "move",
    });
  });
});

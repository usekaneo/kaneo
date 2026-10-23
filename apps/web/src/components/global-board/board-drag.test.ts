import { describe, expect, it } from "vite-plus/test";
import type { GlobalBoardTask } from "@/fetchers/task/get-global-board-tasks";
import { dropIndex, laneTasksDuringDrag } from "./board-drag";

const task = (id: string) => ({ id }) as GlobalBoardTask;
const ids = (tasks: GlobalBoardTask[]) => tasks.map((t) => t.id);
const todo = [task("a"), task("x"), task("b")];

describe("laneTasksDuringDrag", () => {
  it("leaves lanes alone without a drag", () => {
    expect(ids(laneTasksDuringDrag("to-do", todo, null))).toEqual([
      "a",
      "x",
      "b",
    ]);
  });

  it("lets the sorting animation handle a drag inside its own lane", () => {
    const drag = {
      task: task("x"),
      from: "to-do",
      lane: "to-do",
      index: 0,
    } as const;
    expect(ids(laneTasksDuringDrag("to-do", todo, drag))).toEqual([
      "a",
      "x",
      "b",
    ]);
  });

  it("previews a card leaving its lane and entering another", () => {
    const drag = {
      task: task("x"),
      from: "to-do",
      lane: "done",
      index: 1,
    } as const;
    expect(ids(laneTasksDuringDrag("to-do", todo, drag))).toEqual(["a", "b"]);
    expect(
      ids(laneTasksDuringDrag("done", [task("d1"), task("d2")], drag)),
    ).toEqual(["d1", "x", "d2"]);
  });

  it("holds a dropped card in place until the cache catches up", () => {
    const drag = {
      task: task("x"),
      from: "to-do",
      lane: "to-do",
      index: 2,
      dropped: true,
    } as const;
    expect(ids(laneTasksDuringDrag("to-do", todo, drag))).toEqual([
      "a",
      "b",
      "x",
    ]);
  });
});

describe("dropIndex", () => {
  it("takes the index of the card it was released over", () => {
    expect(dropIndex(todo, "x", "b")).toBe(2);
    expect(dropIndex(todo, "x", "a")).toBe(0);
  });

  it("goes last over the lane itself, and stays put over its own card", () => {
    expect(dropIndex(todo, "x", null)).toBe(2);
    expect(dropIndex(todo, "x", "x")).toBe(1);
    expect(dropIndex(todo, "x", "elsewhere")).toBe(1);
  });
});

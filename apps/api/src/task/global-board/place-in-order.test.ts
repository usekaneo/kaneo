import { describe, expect, it } from "vite-plus/test";
import { placeInOrder } from "./place-in-order";

const place = (
  ids: string[],
  positions: Record<string, number>,
  taskId = "x",
) =>
  Object.fromEntries(
    placeInOrder(ids, taskId, new Map(Object.entries(positions))),
  );

describe("placeInOrder", () => {
  it("puts a task between two placed neighbours", () => {
    expect(place(["a", "x", "b"], { a: 1, b: 2 })).toEqual({ x: 1.5 });
  });

  it("goes above the first task or into an empty lane", () => {
    expect(place(["x", "a"], { a: 4 })).toEqual({ x: 3 });
    expect(place(["x", "a"], {})).toEqual({ x: 0 });
    expect(place(["x"], {})).toEqual({ x: 0 });
  });

  it("goes after the last placed task, ahead of unplaced ones", () => {
    expect(place(["a", "x", "u"], { a: 7 })).toEqual({ x: 8 });
  });

  it("places the unplaced tasks above a task dropped among them", () => {
    expect(place(["a", "u1", "u2", "x", "u3"], { a: 7 })).toEqual({
      u1: 8,
      u2: 9,
      x: 10,
    });
    expect(place(["u1", "x"], {})).toEqual({ u1: 0, x: 1 });
  });

  it("ignores its own previous position", () => {
    expect(place(["a", "x", "b"], { a: 1, x: 99, b: 2 })).toEqual({ x: 1.5 });
  });

  it("writes nothing when the task is not in the lane", () => {
    expect(place(["a"], { a: 1 })).toEqual({});
  });
});

import { describe, expect, it } from "vite-plus/test";
import { placeMovedTask } from "./place-moved-task";

const column = (...positions: (number | null)[]) =>
  positions.map((position, index) => ({ id: `t${index}`, position }));
const positions = (tasks: { position?: number | null }[]) =>
  tasks.map((task) => task.position);

describe("placeMovedTask", () => {
  it("lands in the middle of a gap without touching neighbours", () => {
    const tasks = column(1, 99, 5);
    placeMovedTask(tasks, 1);
    expect(positions(tasks)).toEqual([1, 3, 5]);
  });

  it("puts a task dropped at the top below the first position", () => {
    const tasks = column(99, 1, 2, 3, 4);
    placeMovedTask(tasks, 0);
    expect(positions(tasks)).toEqual([0, 1, 2, 3, 4]);
  });

  it("appends after the last task", () => {
    const tasks = column(1, 2, 3, 0);
    placeMovedTask(tasks, 3);
    expect(positions(tasks)).toEqual([1, 2, 3, 4]);
  });

  it("shifts the shorter side of a dense column", () => {
    const tasks = column(1, 2, 99, 3, 4, 5, 6, 7);
    placeMovedTask(tasks, 2);
    expect(positions(tasks)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("shifts later tasks when earlier ones cannot go below zero", () => {
    const tasks = column(0, 1, 99, 2, 3);
    placeMovedTask(tasks, 2);
    expect(positions(tasks)).toEqual([0, 1, 2, 3, 4]);
  });

  it("orders tasks that never had distinct positions", () => {
    const tasks = column(0, 0, 0, null);
    placeMovedTask(tasks, 1);
    expect(positions(tasks)).toEqual([0, 1, 2, 3]);
  });

  it("spaces out a long dense column once so later drops touch one task", () => {
    const tasks = column(99, ...Array.from({ length: 40 }, (_, i) => i));
    placeMovedTask(tasks, 0);
    expect(positions(tasks).slice(0, 3)).toEqual([1024, 2048, 3072]);

    const [moved] = tasks.splice(5, 1);
    tasks.splice(0, 0, moved);
    const before = positions(tasks);
    placeMovedTask(tasks, 0);
    const changed = positions(tasks).filter(
      (position, index) => position !== before[index],
    );
    expect(changed).toEqual([511]);
  });
});

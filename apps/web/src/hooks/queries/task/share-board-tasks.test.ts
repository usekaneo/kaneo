import { describe, expect, it } from "vite-plus/test";
import { shareBoardTasks } from "./share-board-tasks";

const task = (id: string, position: number, title = id) => ({
  id,
  position,
  title,
  labels: [{ id: `${id}-label` }],
});

function board() {
  return {
    id: "project",
    name: "Board",
    columns: [
      { id: "todo", slug: "todo", tasks: [task("a", 1), task("b", 2)] },
      {
        id: "done",
        slug: "done",
        tasks: [task("c", 1), task("d", 2), task("e", 3)],
      },
    ],
    plannedTasks: [task("p", 1)],
    archivedTasks: [],
  };
}

describe("shareBoardTasks", () => {
  it("returns the previous board when nothing changed", () => {
    const previous = board();
    expect(shareBoardTasks(previous, board())).toBe(previous);
  });

  it("keeps every card's identity when one moves to the top of a column", () => {
    const previous = board();
    const next = board();
    const [moved] = next.columns[0].tasks.splice(0, 1);
    next.columns[1].tasks.unshift({ ...moved, position: 0 });

    const shared = shareBoardTasks(previous, next) as ReturnType<typeof board>;

    const [todo, done] = previous.columns;
    expect(shared.columns[0].tasks[0]).toBe(todo.tasks[1]);
    expect(shared.columns[1].tasks.slice(1)).toEqual(done.tasks);
    done.tasks.forEach((card, index) =>
      expect(shared.columns[1].tasks[index + 1]).toBe(card),
    );
    expect(shared.columns[1].tasks[0]).not.toBe(todo.tasks[0]);
    expect(shared.plannedTasks).toBe(previous.plannedTasks);
  });

  it("replaces only the card whose fields changed", () => {
    const previous = board();
    const next = board();
    next.columns[1].tasks[1] = task("d", 2, "renamed");

    const shared = shareBoardTasks(previous, next) as ReturnType<typeof board>;

    expect(shared.columns[0]).toBe(previous.columns[0]);
    expect(shared.columns[1].tasks[0]).toBe(previous.columns[1].tasks[0]);
    expect(shared.columns[1].tasks[1].title).toBe("renamed");
    expect(shared.columns[1].tasks[1].labels).toBe(
      previous.columns[1].tasks[1].labels,
    );
  });

  it("falls back to deep sharing for data that is not a board", () => {
    const previous = { value: [1, 2] };
    expect(shareBoardTasks(previous, { value: [1, 2] })).toBe(previous);
  });
});

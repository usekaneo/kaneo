import { describe, expect, it } from "vite-plus/test";
import { classifyProjectColumns } from "./global-status";

const column = (
  slug: string,
  name: string,
  position: number,
  isFinal = false,
) => ({ slug, name, position, isFinal });

describe("classifyProjectColumns", () => {
  it("maps the default workflow", () => {
    expect(
      Object.fromEntries(
        classifyProjectColumns([
          column("to-do", "To Do", 0),
          column("in-progress", "In Progress", 1),
          column("in-review", "In Review", 2),
          column("done", "Done", 3, true),
        ]),
      ),
    ).toEqual({
      "to-do": "to-do",
      "in-progress": "in-progress",
      "in-review": "in-progress",
      done: "done",
    });
  });

  it("places unnamed stages by their position in the workflow", () => {
    expect(
      Object.fromEntries(
        classifyProjectColumns([
          column("ideas", "Ideas", 0),
          column("ready", "Ready", 1),
          column("building", "Building", 2),
          column("shipped", "Live", 3, true),
        ]),
      ),
    ).toEqual({
      ideas: "to-do",
      ready: "in-progress",
      building: "in-progress",
      shipped: "done",
    });

    expect(
      classifyProjectColumns([
        column("inbox-2", "Inbox 2", 0),
        column("ready", "Ready", 1),
        column("doing", "Doing", 2),
      ]).get("ready"),
    ).toBe("to-do");

    expect(
      classifyProjectColumns([
        column("backlog", "Backlog", 0),
        column("to-do", "To Do", 1),
        column("building", "Building", 2),
      ]).get("building"),
    ).toBe("in-progress");
  });

  it("prefers a renamed column's current name over its original slug", () => {
    const statuses = classifyProjectColumns([
      column("to-do", "Ready to Start", 0),
      column("in-progress", "Backlog", 1),
      column("in-review", "Doing", 2),
    ]);
    expect(statuses.get("to-do")).toBe("to-do");
    expect(statuses.get("in-progress")).toBe("to-do");
    expect(statuses.get("in-review")).toBe("in-progress");
  });

  it("treats final columns as done whatever they are called", () => {
    expect(
      classifyProjectColumns([column("to-do", "To Do", 0, true)]).get("to-do"),
    ).toBe("done");
  });

  it("refuses to place a non-final column named like a finished state", () => {
    const statuses = classifyProjectColumns([
      column("to-do", "To Do", 0),
      column("done", "Done", 1),
    ]);
    expect(statuses.get("done")).toBeNull();
  });

  it("refuses to place a slug shared by columns that map differently", () => {
    const statuses = classifyProjectColumns([
      column("work", "To Do", 0),
      column("work", "Doing", 1),
      column("done", "Done", 2, true),
    ]);
    expect(statuses.get("work")).toBeNull();
    expect(statuses.get("done")).toBe("done");
  });

  it("keeps a duplicated slug when every copy agrees", () => {
    expect(
      classifyProjectColumns([
        column("done", "Done", 3, true),
        column("done", "Done", 4, true),
      ]).get("done"),
    ).toBe("done");
  });
});

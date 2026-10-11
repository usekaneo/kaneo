import { describe, expect, it } from "vite-plus/test";
import { toPluginProject } from "./to-plugin-project";

describe("toPluginProject", () => {
  it("keeps the stable project fields and columns in board order", () => {
    const board = {
      id: "p1",
      workspaceId: "w1",
      name: "Launch",
      slug: "LAU",
      icon: "Rocket",
      isPublic: false,
      columns: [
        {
          id: "to-do",
          name: "To do",
          slug: "to-do",
          position: 0,
          icon: null,
          isFinal: false,
          tasks: [{ id: "t1" }],
        },
        {
          id: "done",
          name: "Done",
          slug: "done",
          position: 1,
          icon: "check",
          isFinal: true,
          tasks: [],
        },
        {
          id: "review",
          name: "Review",
          slug: "review",
          position: 2,
          icon: null,
          isFinal: null,
          tasks: [],
        },
      ],
      plannedTasks: [],
    };

    expect(toPluginProject(board)).toEqual({
      id: "p1",
      workspaceId: "w1",
      name: "Launch",
      slug: "LAU",
      columns: [
        { id: "to-do", name: "To do", slug: "to-do", isFinal: false },
        { id: "done", name: "Done", slug: "done", isFinal: true },
        { id: "review", name: "Review", slug: "review", isFinal: false },
      ],
    });
  });

  it("labels columns with the host's translated names", () => {
    const project = toPluginProject(
      {
        id: "p1",
        workspaceId: "w1",
        name: "Launch",
        slug: "LAU",
        columns: [
          { id: "c1", name: "Done", slug: "done", isFinal: true },
          { id: "c2", name: "QA", slug: "qa", isFinal: false },
        ],
      },
      (slug, name) => (slug === "done" ? "Erledigt" : name),
    );

    expect(project.columns.map((column) => column.name)).toEqual([
      "Erledigt",
      "QA",
    ]);
  });
});

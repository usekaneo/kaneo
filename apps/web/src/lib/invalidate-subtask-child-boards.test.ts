import { QueryClient } from "@tanstack/react-query";
import { expect, it } from "vite-plus/test";
import { invalidateSubtaskChildBoards } from "./invalidate-subtask-child-boards";

it.each(["column", "planned", "archived"])(
  "refreshes only boards containing a child of the renamed parent (%s)",
  async (location) => {
    const client = new QueryClient();
    const child = {
      id: "child",
      subtaskParents: [
        { id: "parent", title: "Old title", projectId: "project" },
      ],
    };
    client.setQueryData(["tasks", "child-project"], {
      columns: [{ tasks: location === "column" ? [child] : [] }],
      plannedTasks: location === "planned" ? [child] : [],
      archivedTasks: location === "archived" ? [child] : [],
    });
    client.setQueryData(["tasks", "unrelated"], {
      columns: [{ tasks: [{ id: "other" }] }],
      plannedTasks: [],
      archivedTasks: [],
    });
    client.setQueryData(["task", "parent"], { title: "New title" });
    await invalidateSubtaskChildBoards(client, "parent");
    expect(
      client.getQueryState(["tasks", "child-project"])?.isInvalidated,
    ).toBe(true);
    expect(client.getQueryState(["tasks", "unrelated"])?.isInvalidated).toBe(
      false,
    );
    expect(client.getQueryState(["task", "parent"])?.isInvalidated).toBe(false);
  },
);

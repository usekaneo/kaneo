import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vite-plus/test";
import { removeTasksFromRelations } from "./remove-task-from-relations";

const relation = (id: string, sourceTaskId: string, targetTaskId: string) => ({
  id,
  sourceTaskId,
  targetTaskId,
  relationType: "subtask",
});

describe("removeTasksFromRelations", () => {
  it("drops deleted tasks from every cached relation list", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      ["task-relations", "parent"],
      [
        relation("r1", "parent", "sub-a"),
        relation("r2", "parent", "sub-b"),
        relation("r3", "parent", "sub-c"),
      ],
    );
    queryClient.setQueryData(
      ["task-relations", "sub-a"],
      [relation("r1", "parent", "sub-a")],
    );

    removeTasksFromRelations(queryClient, ["sub-a", "sub-c"]);

    expect(queryClient.getQueryData(["task-relations", "parent"])).toEqual([
      relation("r2", "parent", "sub-b"),
    ]);
    expect(
      queryClient.getQueryData(["task-relations", "sub-a"]),
    ).toBeUndefined();
    expect(
      queryClient.getQueryState(["task-relations", "parent"])?.isInvalidated,
    ).toBe(true);
  });
});

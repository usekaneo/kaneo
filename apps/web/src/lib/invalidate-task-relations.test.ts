import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vite-plus/test";
import { invalidateTaskRelations } from "./invalidate-task-relations";

describe("invalidateTaskRelations", () => {
  it.each(["parent", "child"])(
    "refreshes inactive relation lists after moving the %s",
    async (taskId) => {
      const client = new QueryClient({
        defaultOptions: { queries: { refetchOnMount: false } },
      });
      const before = [
        {
          sourceTaskId: "parent",
          targetTaskId: "child",
          sourceTask: { projectId: "old", number: 1 },
          targetTask: { projectId: "old", number: 2 },
        },
      ];
      const after = before.map((relation) => ({
        ...relation,
        [taskId === "parent" ? "sourceTask" : "targetTask"]: {
          projectId: "new",
          number: 3,
        },
      }));
      const fetchRelations = vi.fn().mockResolvedValue(before);
      for (const id of ["parent", "child"]) {
        await client.fetchQuery({
          queryKey: ["task-relations", id],
          queryFn: fetchRelations,
        });
      }
      fetchRelations.mockResolvedValue(after);

      await invalidateTaskRelations(client, taskId);

      for (const id of ["parent", "child"]) {
        expect(client.getQueryData(["task-relations", id])).toEqual(after);
      }
      expect(fetchRelations).toHaveBeenCalledTimes(4);
      client.clear();
    },
  );

  it("refreshes the moved task's empty list but leaves unrelated and project queries alone", async () => {
    const client = new QueryClient();
    const own = vi.fn().mockResolvedValue([]);
    await client.fetchQuery({
      queryKey: ["task-relations", "moved"],
      queryFn: own,
    });
    const untouched = [
      ["task-relations", "unrelated"],
      ["task-relations", "project", "project-1"],
      ["tasks", "project-1"],
    ];
    for (const key of untouched) {
      client.setQueryData(key, [
        { sourceTaskId: "other", targetTaskId: "another" },
      ]);
    }

    await invalidateTaskRelations(client, "moved");

    expect(own).toHaveBeenCalledTimes(2);
    for (const key of untouched) {
      expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    }
    client.clear();
  });
});

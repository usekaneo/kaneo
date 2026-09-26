import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { invalidateRelationTaskProject } from "./invalidate-relation-task-project";

describe("invalidateRelationTaskProject", () => {
  it.each(["columns", "plannedTasks", "archivedTasks"])(
    "refreshes the parent in %s without invalidating unrelated boards",
    async (location) => {
      const client = new QueryClient();
      const parent = { id: "parent" };
      client.setQueryData(["tasks", "parent-project"], {
        columns: location === "columns" ? [{ tasks: [parent] }] : [],
        plannedTasks: location === "plannedTasks" ? [parent] : [],
        archivedTasks: location === "archivedTasks" ? [parent] : [],
      });
      client.setQueryData(["tasks", "unrelated-project"], {
        columns: [{ tasks: [{ id: "other" }] }],
      });
      await invalidateRelationTaskProject(client, "parent");
      expect(
        client.getQueryState(["tasks", "parent-project"])?.isInvalidated,
      ).toBe(true);
      expect(
        client.getQueryState(["tasks", "unrelated-project"])?.isInvalidated,
      ).toBe(false);
      client.clear();
    },
  );
});

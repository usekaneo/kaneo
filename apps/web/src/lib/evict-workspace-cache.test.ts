import { QueryClient } from "@tanstack/react-query";
import { expect, it } from "vite-plus/test";
import { evictWorkspaceCache } from "./evict-workspace-cache";

it("evicts revoked and unscoped private data while preserving another workspace's board", () => {
  const client = new QueryClient();
  client.setQueryData(["tasks", "revoked-project"], {
    id: "revoked-project",
    workspaceId: "revoked",
    columns: [
      { tasks: [{ id: "revoked-task", projectId: "revoked-project" }] },
    ],
  });
  const active = { id: "active-project", workspaceId: "active", columns: [] };
  client.setQueryData(["tasks", "active-project"], active);
  client.setQueryData(["task", "revoked-task"], {
    id: "revoked-task",
    projectId: "revoked-project",
    description: "private",
  });
  client.setQueryData(["task", "unscoped"], {
    id: "unscoped",
    projectId: "no-project-cache",
    description: "private",
  });
  evictWorkspaceCache(client, "revoked");
  expect(client.getQueryData(["tasks", "active-project"])).toEqual(active);
  expect(client.getQueryData(["tasks", "revoked-project"])).toBeUndefined();
  expect(client.getQueryData(["task", "revoked-task"])).toBeUndefined();
  expect(client.getQueryData(["task", "unscoped"])).toBeUndefined();
  client.clear();
});

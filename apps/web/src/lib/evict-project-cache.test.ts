import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it, vi } from "vite-plus/test";
import { evictProjectCache } from "./evict-project-cache";

it("evicts the revoked project's data while keeping other projects", () => {
  const client = new QueryClient();
  const revoked = {
    id: "revoked-project",
    workspaceId: "workspace",
    columns: [
      { tasks: [{ id: "revoked-task", projectId: "revoked-project" }] },
    ],
  };
  const kept = {
    id: "kept-project",
    workspaceId: "workspace",
    columns: [{ tasks: [{ id: "kept-task", projectId: "kept-project" }] }],
  };
  client.setQueryData(["tasks", "revoked-project"], revoked);
  client.setQueryData(["tasks", "kept-project"], kept);
  client.setQueryData(["projects", "workspace", "revoked-project"], revoked);
  client.setQueryData(["task", "revoked-task"], {
    id: "revoked-task",
    projectId: "revoked-project",
  });
  client.setQueryData(["comments", "revoked-task"], [{ id: "comment" }]);
  client.setQueryData(["task", "kept-task"], {
    id: "kept-task",
    projectId: "kept-project",
  });
  client.setQueryData(["labels", "workspace"], [{ id: "label" }]);
  evictProjectCache(client, "revoked-project");
  for (const key of [
    ["tasks", "revoked-project"],
    ["projects", "workspace", "revoked-project"],
    ["task", "revoked-task"],
    ["comments", "revoked-task"],
  ])
    expect(client.getQueryData(key)).toBeUndefined();
  expect(client.getQueryData(["tasks", "kept-project"])).toEqual(kept);
  expect(client.getQueryData(["task", "kept-task"])).toBeDefined();
  expect(client.getQueryData(["labels", "workspace"])).toBeDefined();
  client.clear();
});

it("refetches an active project list that still lists the revoked project", async () => {
  const client = new QueryClient();
  const queryFn = vi.fn().mockResolvedValue([{ id: "kept-project" }]);
  client.setQueryData(
    ["projects", "workspace"],
    [{ id: "revoked-project" }, { id: "kept-project" }],
  );
  const observer = new QueryObserver(client, {
    queryKey: ["projects", "workspace"],
    queryFn,
    staleTime: Infinity,
  });
  const unsubscribe = observer.subscribe(() => {});
  evictProjectCache(client, "revoked-project");
  await vi.waitFor(() =>
    expect(client.getQueryData(["projects", "workspace"])).toEqual([
      { id: "kept-project" },
    ]),
  );
  expect(queryFn).toHaveBeenCalledOnce();
  unsubscribe();
  client.clear();
});

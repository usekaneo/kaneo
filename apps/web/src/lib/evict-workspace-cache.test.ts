import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it } from "vite-plus/test";
import {
  evictInaccessibleWorkspaceCache,
  evictWorkspaceCache,
} from "./evict-workspace-cache";

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
  client.setQueryData(["projects", "active"], [active]);
  client.setQueryData(
    ["projects", "revoked"],
    [{ id: "revoked-project", workspaceId: "revoked" }],
  );
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
  expect(client.getQueryData(["projects", "active"])).toEqual([active]);
  expect(client.getQueryData(["projects", "revoked"])).toBeUndefined();
  expect(client.getQueryData(["tasks", "revoked-project"])).toBeUndefined();
  expect(client.getQueryData(["task", "revoked-task"])).toBeUndefined();
  expect(client.getQueryData(["task", "unscoped"])).toBeUndefined();
  client.clear();
});

it("cancels unknown project settings reads when membership is revoked", async () => {
  const client = new QueryClient();
  for (const prefix of [
    "github-integration",
    "github-repositories",
    "gitea-repositories",
    "gitlab-projects",
    "calendar-feeds",
    "columns",
    "workflow-rules",
    "custom-fields",
  ]) {
    let finish!: (value: string) => void;
    const pending = client.fetchQuery({
      queryKey: [prefix, "unknown-project"],
      queryFn: () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    });
    evictWorkspaceCache(client, "revoked");
    finish("private");
    await pending.catch(() => undefined);
    expect(client.getQueryData([prefix, "unknown-project"])).toBeUndefined();
  }
  client.clear();
});

it("reconciles missed revocations against a reconnect access snapshot", () => {
  const client = new QueryClient();
  const active = { id: "active-project", workspaceId: "active", columns: [] };
  client.setQueryData(["tasks", "active-project"], active);
  client.setQueryData(["tasks", "old-project"], {
    id: "old-project",
    workspaceId: "revoked",
    columns: [],
  });
  client.setQueryData(["github-integration", "unknown-project"], {
    repository: "private",
  });
  evictInaccessibleWorkspaceCache(client, ["active"]);
  expect(client.getQueryData(["tasks", "active-project"])).toEqual(active);
  expect(client.getQueryData(["tasks", "old-project"])).toBeUndefined();
  expect(
    client.getQueryData(["github-integration", "unknown-project"]),
  ).toBeUndefined();
  client.clear();
});

it("refetches an active board whose pending read has no workspace scope yet", async () => {
  const client = new QueryClient();
  const board = {
    id: "project",
    workspaceId: "active",
    columns: [{ tasks: [{ id: "task", title: "Still visible" }] }],
  };
  let finishOld!: (value: unknown) => void;
  let reads = 0;
  const options = {
    queryKey: ["tasks", "project"],
    staleTime: Infinity,
    retry: false,
    queryFn: () => {
      reads++;
      return reads === 1
        ? new Promise<unknown>((resolve) => {
            finishOld = resolve;
          })
        : Promise.resolve(board);
    },
  };
  const observer = new QueryObserver(client, options);
  const unsubscribe = observer.subscribe(() => {});
  expect(reads).toBe(1);
  evictInaccessibleWorkspaceCache(client, ["active"]);
  finishOld({ workspaceId: "revoked", description: "private" });
  await client.fetchQuery(options);
  expect(reads).toBe(2);
  expect(observer.getCurrentResult().data).toEqual(board);
  expect(client.getQueryData(options.queryKey)).toEqual(board);
  unsubscribe();
  client.clear();
});

it.each(["revocation", "snapshot"])(
  "preserves nested workspace-scoped search keys during %s",
  (kind) => {
    const client = new QueryClient();
    const allowedKey = ["search", { query: "task", workspaceId: "allowed" }];
    const revokedKey = ["search", { query: "task", workspaceId: "revoked" }];
    client.setQueryData(allowedKey, { results: ["allowed task"] });
    client.setQueryData(revokedKey, { results: ["private task"] });
    if (kind === "revocation") evictWorkspaceCache(client, "revoked");
    else evictInaccessibleWorkspaceCache(client, ["allowed"]);
    expect(client.getQueryData(allowedKey)).toEqual({
      results: ["allowed task"],
    });
    expect(client.getQueryData(revokedKey)).toBeUndefined();
    client.clear();
  },
);

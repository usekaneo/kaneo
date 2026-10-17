import { QueryClient } from "@tanstack/react-query";
import { expect, it } from "vite-plus/test";
import { patchSyncTaskTitles } from "./patch-sync-task-titles";

it("updates saved and draft task names without changing scope or tokens", () => {
  const client = new QueryClient();
  const snapshot = {
    matchingTasks: [
      { id: "task", title: "Old" },
      { id: "other", title: "Other" },
    ],
    pausedTasks: [{ id: "task", title: "Old", linkId: "link" }],
    matching: 3,
    willPause: 2,
    previewToken: "reviewed",
  };
  const keys = [
    ["integration-sync", "project", "github", ""],
    ["integration-sync-preview", "project", "gitea", { outgoing: "labels" }],
  ];
  for (const key of keys) client.setQueryData(key, snapshot);
  client.setQueryData(["integration-sync", "foreign"], snapshot);
  client.setQueryData(
    ["integration-sync-review", "project", "github", "link"],
    { token: "review" },
  );
  patchSyncTaskTitles(client, "project", "task", "Current");
  for (const key of keys)
    expect(client.getQueryData(key)).toEqual({
      ...snapshot,
      matchingTasks: [
        { id: "task", title: "Current" },
        { id: "other", title: "Other" },
      ],
      pausedTasks: [{ id: "task", title: "Current", linkId: "link" }],
    });
  expect(client.getQueryData(["integration-sync", "foreign"])).toBe(snapshot);
  expect(
    client.getQueryData([
      "integration-sync-review",
      "project",
      "github",
      "link",
    ]),
  ).toEqual({ token: "review" });
  client.clear();
});

import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import {
  getBoardCacheVersion,
  markBoardCacheChanged,
} from "./board-cache-version";
import { patchBoardTask } from "./patch-board-task";
import { updateBoardTaskCache } from "./update-board-task-cache";

function board() {
  return {
    id: "p",
    columns: [
      {
        id: "todo",
        slug: "todo",
        tasks: [
          {
            id: "a",
            projectId: "p",
            status: "todo",
            title: "old",
            userId: "u",
            assigneeId: "u",
            labels: [{ id: "label" }],
            subtaskCounts: { completed: 1, total: 3 },
          },
        ],
      },
      { id: "doing", slug: "doing", tasks: [] },
    ],
    archivedTasks: [],
    plannedTasks: [],
  } as unknown as ProjectWithTasks;
}

describe("bounded board cache updates", () => {
  it("preserves metadata and the assignee when updating a single field", () => {
    const client = new QueryClient();
    client.setQueryData(["tasks", "p"], board());
    updateBoardTaskCache(client, "p", "a", { title: "new" });
    expect(
      client.getQueryData<ProjectWithTasks>(["tasks", "p"])?.columns[0]
        .tasks[0],
    ).toMatchObject({
      title: "new",
      assigneeId: "u",
      labels: [{ id: "label" }],
      subtaskCounts: { completed: 1, total: 3 },
    });
    client.clear();
  });

  it("lets a pending board load finish and applies only the newest local edit afterward", async () => {
    const client = new QueryClient();
    let finish!: (value: ProjectWithTasks) => void;
    const loading = client.fetchQuery({
      queryKey: ["tasks", "p"],
      queryFn: () =>
        new Promise<ProjectWithTasks>((resolve) => {
          finish = resolve;
        }),
    });
    updateBoardTaskCache(client, "p", "a", { title: "first" });
    updateBoardTaskCache(client, "p", "a", { title: "latest" });
    expect(client.getQueryState(["tasks", "p"])?.fetchStatus).toBe("fetching");
    finish(board());
    await loading;
    expect(
      client.getQueryData<ProjectWithTasks>(["tasks", "p"])?.columns[0].tasks[0]
        .title,
    ).toBe("latest");
    client.clear();
  });

  it("moves a refreshed task by column slug and removes tasks moved out of the project", () => {
    const moved = patchBoardTask(board(), "a", {
      projectId: "p",
      status: "doing",
    })!;
    expect(moved.columns[0].tasks).toHaveLength(0);
    expect(moved.columns[1].tasks.map((task) => task.id)).toEqual(["a"]);
    expect(
      patchBoardTask(moved, "a", { projectId: "other" })?.columns[1].tasks,
    ).toHaveLength(0);
  });
});

it("rejects a late mutation response after a newer socket patch", () => {
  const client = new QueryClient();
  client.setQueryData(["tasks", "p"], board());
  markBoardCacheChanged(client, "p", "a");
  const version = getBoardCacheVersion(client, "p", "a");
  const invalidate = vi.spyOn(client, "invalidateQueries");
  markBoardCacheChanged(client, "p", "a");
  client.setQueryData(
    ["tasks", "p"],
    patchBoardTask(board(), "a", { projectId: "p", title: "remote" }),
  );
  updateBoardTaskCache(client, "p", "a", { title: "late response" }, version);
  expect(
    client.getQueryData<ProjectWithTasks>(["tasks", "p"])?.columns[0].tasks[0]
      .title,
  ).toBe("remote");
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["tasks", "p"] });
  client.clear();
});
it("defers descriptions exceeding the UTF-8 board limit", () => {
  const updated = patchBoardTask(board(), "a", {
    projectId: "p",
    description: "😀".repeat(20000),
  });
  expect(updated?.columns[0].tasks[0]).toMatchObject({
    description: null,
    descriptionDeferred: true,
  });
});

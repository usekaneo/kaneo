import { describe, expect, it, vi } from "vitest";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { loadBoardPages } from "./load-board-pages";

function task(id: string, status = "to-do"): Task {
  return {
    id,
    title: id,
    description: `${id} searchable description`,
    number: 1,
    status,
    priority: "low",
    startDate: null,
    dueDate: null,
    position: 1,
    createdAt: "2020-01-01T00:00:00Z",
    userId: null,
    assigneeId: null,
    assigneeName: null,
    projectId: "project",
    labels: [{ id: `label-${id}`, name: id, color: "red" }],
    externalLinks: [],
  };
}
function board(id: string): ProjectWithTasks {
  return {
    id: "project",
    name: "Project",
    slug: "project",
    icon: null,
    description: null,
    isPublic: false,
    workspaceId: "workspace",
    columns: [
      {
        id: "to-do",
        slug: "to-do",
        name: "To do",
        icon: null,
        isFinal: false,
        tasks: [task(id)],
      },
    ],
    plannedTasks: [task(`planned-${id}`, "planned")],
    archivedTasks: [task(`archived-${id}`, "archived")],
  };
}
function page(number: number, totalPages = 3) {
  return {
    data: board(String(number)),
    pagination: {
      page: number,
      pageSize: 3,
      totalPages,
      total: totalPages * 3,
    },
  };
}
describe("complete board loading through bounded pages", () => {
  it("loads sequentially and merges every column, planned and archived task with its complete fields", async () => {
    let active = 0;
    let peak = 0;
    const load = vi.fn(async (number: number) => {
      active++;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active--;
      return page(number);
    });
    const result = await loadBoardPages(load);
    expect(load.mock.calls).toEqual([[1], [2], [3]]);
    expect(peak).toBe(1);
    expect(result.columns[0].tasks.map((task) => task.id)).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(result.plannedTasks.map((task) => task.id)).toEqual([
      "planned-1",
      "planned-2",
      "planned-3",
    ]);
    expect(result.archivedTasks).toHaveLength(3);
    expect(result.columns[0].tasks[2]).toMatchObject({
      description: "3 searchable description",
      labels: [{ id: "label-3" }],
    });
  });
  it("collects all related pages without dropping or duplicating labels, links or late columns", async () => {
    const load = vi.fn(async (number: number, relatedPage = 1) => {
      const response = page(number, 2);
      response.data.columns[0].position = 200;
      response.data.columns[0].tasks[0].labels = [
        { id: `label-${number}-${relatedPage}`, name: "Label", color: "red" },
      ];
      response.data.columns[0].tasks[0].externalLinks = [
        {
          id: `link-${number}-${relatedPage}`,
          taskId: String(number),
          integrationId: "integration",
          resourceType: "issue",
          externalId: "1",
          url: "https://example.com",
          title: null,
          metadata: null,
        },
      ];
      response.data.columns.push({
        id: `column-${relatedPage}`,
        slug: `column-${relatedPage}`,
        name: "Column",
        icon: null,
        isFinal: false,
        position: relatedPage,
        tasks: [],
      });
      return {
        ...response,
        pagination: {
          ...response.pagination,
          relatedTotalPages: relatedPage === 1 ? 3 : 999,
        },
      };
    });
    const result = await loadBoardPages(load);
    expect(load.mock.calls).toEqual([[1], [1, 2], [1, 3], [2], [2, 2], [2, 3]]);
    expect(result.columns.map((column) => column.id)).toEqual([
      "column-1",
      "column-2",
      "column-3",
      "to-do",
    ]);
    for (const [index, value] of result.columns[3].tasks.entries()) {
      expect(value.labels?.map((label) => label.id)).toEqual(
        [1, 2, 3].map((n) => `label-${index + 1}-${n}`),
      );
      expect(value.externalLinks).toHaveLength(3);
    }
    expect(result.plannedTasks).toHaveLength(2);
    expect(result.archivedTasks).toHaveLength(2);
  });
  it("rejects a failed related continuation instead of exposing a partially hydrated board", async () => {
    const first = page(1, 1);
    const load = vi
      .fn()
      .mockResolvedValueOnce({
        ...first,
        pagination: { ...first.pagination, relatedTotalPages: 2 },
      })
      .mockRejectedValueOnce(new Error("related failed"));
    await expect(loadBoardPages(load)).rejects.toThrow("related failed");
  });
  it("does not expose an incomplete board as success when a later page fails", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(page(1))
      .mockRejectedValueOnce(new Error("permission revoked"));
    await expect(loadBoardPages(load)).rejects.toThrow("permission revoked");
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("honors cancellation and stops scheduling pages after the active request", async () => {
    const controller = new AbortController();
    const load = vi.fn(async (number: number) => {
      if (number === 2) controller.abort();
      return page(number);
    });
    await expect(loadBoardPages(load, controller.signal)).rejects.toThrow();
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("uses the first page's work boundary and deduplicates tasks moved across pages", async () => {
    const load = vi.fn(async (number: number) =>
      page(1, number === 1 ? 2 : 100000),
    );
    const result = await loadBoardPages(load);
    expect(load).toHaveBeenCalledTimes(2);
    expect(result.columns[0].tasks).toHaveLength(1);
  });
  it("includes newly encountered columns instead of dropping their tasks", async () => {
    const load = vi.fn(async (number: number) => {
      const next = page(number, 2);
      if (number === 2)
        next.data.columns[0] = {
          ...next.data.columns[0],
          id: "new",
          slug: "new",
          tasks: [task("late", "new")],
        };
      return next;
    });
    const result = await loadBoardPages(load);
    expect(result.columns.map((column) => column.id)).toEqual(["to-do", "new"]);
    expect(result.columns[1].tasks[0].id).toBe("late");
  });
});

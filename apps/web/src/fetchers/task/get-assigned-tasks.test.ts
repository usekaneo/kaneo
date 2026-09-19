import { beforeEach, describe, expect, it, vi } from "vitest";
import getAssignedTasks from "./get-assigned-tasks";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("@kaneo/libs", () => ({
  client: {
    user: {
      tasks: {
        $get: mocks.get,
      },
    },
  },
}));

function page(
  pageNumber: number,
  totalPages: number,
  tasks: string[],
  projects: string[],
) {
  return {
    ok: true,
    json: async () => ({
      data: {
        tasks: tasks.map((id) => ({ id, projectId: projects[0] })),
        projects: projects.map((id) => ({ id })),
      },
      pagination: {
        total: 0,
        page: pageNumber,
        pageSize: 2,
        totalPages,
      },
    }),
  };
}

describe("getAssignedTasks", () => {
  beforeEach(() => {
    mocks.get.mockReset();
  });

  it("requests the first page without a query and stops when it is the only one", async () => {
    mocks.get.mockResolvedValueOnce(page(1, 1, ["a", "b"], ["p1"]));

    const result = await getAssignedTasks();

    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(mocks.get).toHaveBeenCalledWith({ query: {} });
    expect(result.tasks.map((task) => task.id)).toEqual(["a", "b"]);
    expect(result.projects.map((project) => project.id)).toEqual(["p1"]);
  });

  it("walks every page and merges tasks and projects by id", async () => {
    mocks.get.mockImplementation(
      async ({ query }: { query: { page?: string } }) => {
        switch (query.page) {
          case undefined:
            return page(1, 3, ["a", "b"], ["p1"]);
          case "2":
            // A task edited between requests can shift across the page
            // boundary and come back twice.
            return page(2, 3, ["b", "c"], ["p1", "p2"]);
          case "3":
            return page(3, 3, ["d"], ["p2"]);
          default:
            throw new Error(`unexpected page ${query.page}`);
        }
      },
    );

    const result = await getAssignedTasks();

    expect(mocks.get.mock.calls.map(([args]) => args)).toEqual([
      { query: {} },
      { query: { page: "2" } },
      { query: { page: "3" } },
    ]);
    expect(result.tasks.map((task) => task.id)).toEqual(["a", "b", "c", "d"]);
    expect(result.projects.map((project) => project.id)).toEqual(["p1", "p2"]);
  });

  it("fails when any page fails", async () => {
    mocks.get.mockImplementation(
      async ({ query }: { query: { page?: string } }) =>
        query.page === "2"
          ? { ok: false, status: 500 }
          : page(1, 2, ["a"], ["p1"]),
    );

    await expect(getAssignedTasks()).rejects.toThrow(
      "Failed to fetch assigned tasks",
    );
  });
});

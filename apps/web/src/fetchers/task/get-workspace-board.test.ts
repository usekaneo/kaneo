import { beforeEach, expect, it, vi } from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import getWorkspaceBoard, {
  WORKSPACE_BOARD_PARALLEL_PAGES,
} from "./get-workspace-board";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@kaneo/libs", () => ({
  client: { task: { "workspace-board": { $get: request } } },
}));

function page(number: number, totalPages: number) {
  return {
    data: {
      id: "workspace-board:w",
      name: "Workspace tasks",
      slug: "",
      icon: null,
      description: null,
      isPublic: false,
      workspaceId: "w",
      backgroundVersion: null,
      columns: [
        {
          id: "todo",
          slug: "todo",
          name: "To do",
          icon: null,
          isFinal: false,
          position: 0,
          tasks: [{ id: `task-${number}`, labels: [], externalLinks: [] }],
        },
      ],
      archivedTasks: [],
      plannedTasks: [],
      projects: [],
    },
    pagination: { page: number, pageSize: 100, total: 300, totalPages },
  };
}

beforeEach(() => {
  request.mockReset();
});

it("loads a few later pages at once and merges them in order", async () => {
  let inFlight = 0;
  let peak = 0;
  request.mockImplementation(async ({ query }: { query: { page: string } }) => {
    const number = Number(query.page);
    inFlight++;
    peak = Math.max(peak, inFlight);
    // Later pages answer out of order.
    await new Promise((resolve) =>
      setTimeout(resolve, number === 1 ? 0 : 10 - number),
    );
    inFlight--;
    return Response.json(page(number, 8));
  });

  const board = await getWorkspaceBoard("w", { includeCompleted: "false" });

  expect(request).toHaveBeenCalledTimes(8);
  expect(peak).toBe(WORKSPACE_BOARD_PARALLEL_PAGES);
  expect(board.total).toBe(300);
  expect(board.columns[0].tasks.map((task) => task.id)).toEqual(
    Array.from({ length: 8 }, (_, index) => `task-${index + 1}`),
  );
});

it("stops starting pages after one fails", async () => {
  request.mockImplementation(async ({ query }: { query: { page: string } }) => {
    const number = Number(query.page);
    if (number === 2) {
      return Response.json(
        { message: "Workspace board request took too long" },
        { status: 503 },
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
    return Response.json(page(number, 8));
  });
  const error = await getWorkspaceBoard("w", {}).catch((caught) => caught);
  expect(error).toBeInstanceOf(HttpError);
  await new Promise((resolve) => setTimeout(resolve, 30));
  // Pages 3 and 4 were already running; nothing new starts after the failure.
  expect(request).toHaveBeenCalledTimes(1 + WORKSPACE_BOARD_PARALLEL_PAGES);
});

it("reports the API error message", async () => {
  request.mockResolvedValue(
    Response.json({ message: "Workspace not found" }, { status: 404 }),
  );
  const error = await getWorkspaceBoard("w", {}).catch((caught) => caught);
  expect(error).toBeInstanceOf(HttpError);
  expect(error.message).toBe("Workspace not found");
});

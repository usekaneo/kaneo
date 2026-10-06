import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import getPublicProject from "../project/get-public-project";
import getTasks from "./get-tasks";

const { privateRequest, publicRequest } = vi.hoisted(() => ({
  privateRequest: vi.fn(),
  publicRequest: vi.fn(),
}));
vi.mock("@kaneo/libs", () => ({
  client: {
    task: { tasks: { ":projectId": { $get: privateRequest } } },
    "public-project": { ":id": { $get: publicRequest } },
  },
}));
function data(page: number) {
  return {
    id: "project",
    name: "Project",
    slug: "project",
    icon: null,
    description: null,
    isPublic: true,
    workspaceId: "workspace",
    columns: [
      {
        id: "todo",
        slug: "todo",
        name: "To do",
        icon: null,
        isFinal: false,
        tasks: [
          {
            id: `task-${page}`,
            title: `Task ${page}`,
            description: `text-${page}`,
            labels: [],
            externalLinks: [],
          },
        ],
      },
    ],
    archivedTasks: [],
    plannedTasks: [],
  };
}
beforeEach(() => {
  privateRequest.mockReset();
  publicRequest.mockReset();
});
describe("authenticated and public board fetchers", () => {
  it.each(["private", "public"])(
    "reads every %s page through the typed client and propagates cancellation",
    async (visibility) => {
      const request = visibility === "private" ? privateRequest : publicRequest;
      request.mockImplementation(
        async ({ query }: { query: { page: string } }) => {
          const page = Number(query.page);
          const pagination = { page, pageSize: 100, total: 201, totalPages: 3 };
          return Response.json(
            visibility === "private"
              ? { data: data(page), pagination }
              : { ...data(page), pagination },
          );
        },
      );
      const controller = new AbortController();
      const result =
        visibility === "private"
          ? await getTasks("project", controller.signal)
          : await getPublicProject({ id: "project" }, controller.signal);
      expect(result.columns[0].tasks.map((task) => task.id)).toEqual([
        "task-1",
        "task-2",
        "task-3",
      ]);
      expect(request).toHaveBeenCalledTimes(3);
      for (let index = 0; index < 3; index++)
        expect(request.mock.calls[index]).toEqual([
          {
            param:
              visibility === "private"
                ? { projectId: "project" }
                : { id: "project" },
            query: { page: String(index + 1), limit: "100" },
          },
          { init: { signal: controller.signal } },
        ]);
    },
  );
  it.each(["private", "public"])(
    "sends relatedPage for %s continuations and merges their labels",
    async (visibility) => {
      const request = visibility === "private" ? privateRequest : publicRequest;
      request.mockImplementation(
        async ({ query }: { query: { relatedPage?: string } }) => {
          const related = Number(query.relatedPage ?? 1);
          const board = data(1);
          Object.assign(board.columns[0].tasks[0], {
            labels: [{ id: `label-${related}`, name: "Label", color: "red" }],
          });
          const pagination = {
            page: 1,
            pageSize: 100,
            total: 1,
            totalPages: 1,
            relatedTotalPages: 2,
          };
          return Response.json(
            visibility === "private"
              ? { data: board, pagination }
              : { ...board, pagination },
          );
        },
      );
      const result =
        visibility === "private"
          ? await getTasks("project")
          : await getPublicProject({ id: "project" });
      expect(result.columns[0].tasks[0].labels).toHaveLength(2);
      expect(request.mock.calls[1][0].query).toMatchObject({
        page: "1",
        relatedPage: "2",
        limit: "100",
      });
    },
  );
  it("does not cache a partial public board when its visibility is revoked", async () => {
    publicRequest
      .mockResolvedValueOnce(
        Response.json({
          ...data(1),
          pagination: { page: 1, pageSize: 100, total: 101, totalPages: 2 },
        }),
      )
      .mockResolvedValueOnce(
        new Response("Project is not public", { status: 403 }),
      );
    await expect(getPublicProject({ id: "project" })).rejects.toMatchObject({
      status: 403,
    });
    expect(publicRequest).toHaveBeenCalledTimes(2);
  });
});

it("restarts a public board when concurrent membership or ordering changes its revision", async () => {
  let pass = 0;
  publicRequest.mockImplementation(
    async ({ query }: { query: { page: string; relatedPage?: string } }) => {
      const page = Number(query.page);
      if (page === 1 && !query.relatedPage) pass++;
      const board = data(page);
      board.columns[0].tasks[0].title =
        pass === 1 ? "stale task" : "current task";
      return Response.json({
        ...board,
        pagination: {
          page,
          pageSize: 100,
          total: 201,
          totalPages: 3,
          revision: pass === 1 && page === 1 ? "before edit" : "after edit",
        },
      });
    },
  );
  const result = await getPublicProject({ id: "project" });
  expect(
    publicRequest.mock.calls.map(([request]) => request.query.page),
  ).toEqual(["1", "2", "1", "2", "3"]);
  expect(result.columns[0].tasks.map((task) => task.id)).toEqual([
    "task-1",
    "task-2",
    "task-3",
  ]);
  expect(
    result.columns[0].tasks.every((task) => task.title === "current task"),
  ).toBe(true);
});
it("checks related continuations against the same public board revision", async () => {
  let pass = 0;
  publicRequest.mockImplementation(
    async ({ query }: { query: { relatedPage?: string } }) => {
      if (!query.relatedPage) pass++;
      return Response.json({
        ...data(1),
        pagination: {
          page: 1,
          pageSize: 100,
          total: 1,
          totalPages: 1,
          relatedTotalPages: 2,
          revision: pass === 1 && !query.relatedPage ? "old" : "new",
        },
      });
    },
  );
  await getPublicProject({ id: "project" });
  expect(publicRequest).toHaveBeenCalledTimes(4);
});
it("bounds public board restarts under continuous changes without committing an incomplete result", async () => {
  publicRequest.mockImplementation(
    async ({ query }: { query: { page: string } }) =>
      Response.json({
        ...data(Number(query.page)),
        pagination: {
          page: Number(query.page),
          pageSize: 100,
          total: 201,
          totalPages: 3,
          revision: query.page,
        },
      }),
  );
  await expect(getPublicProject({ id: "project" })).rejects.toThrow();
  expect(
    publicRequest.mock.calls.map(([request]) => request.query.page),
  ).toEqual(["1", "2", "1", "2", "1", "2"]);
});
it("honors cancellation before restarting a changed public board", async () => {
  const controller = new AbortController();
  publicRequest.mockImplementation(
    async ({ query }: { query: { page: string } }) => {
      if (query.page === "2") controller.abort();
      return Response.json({
        ...data(Number(query.page)),
        pagination: {
          page: Number(query.page),
          pageSize: 100,
          total: 201,
          totalPages: 3,
          revision: query.page,
        },
      });
    },
  );
  await expect(
    getPublicProject({ id: "project" }, controller.signal),
  ).rejects.toThrow();
  expect(publicRequest).toHaveBeenCalledTimes(2);
});

it("reconciles shifted related rows while task membership remains unchanged", async () => {
  let pass = 0;
  publicRequest.mockImplementation(
    async ({ query }: { query: { page: string; relatedPage?: string } }) => {
      if (!query.relatedPage) pass++;
      const board = data(1);
      Object.assign(board.columns[0].tasks[0], {
        labels: [
          {
            id:
              pass === 1
                ? "removed-label"
                : `current-${query.relatedPage ?? 1}`,
            name: "Label",
            color: "red",
          },
        ],
      });
      return Response.json({
        ...board,
        pagination: {
          page: 1,
          pageSize: 100,
          total: 1,
          totalPages: 1,
          relatedTotalPages: 2,
          revision: "unchanged tasks and columns",
          relatedRevision:
            pass === 1 && !query.relatedPage ? "old labels" : "new labels",
        },
      });
    },
  );
  const board = await getPublicProject({ id: "project" });
  expect(publicRequest).toHaveBeenCalledTimes(4);
  expect(board.columns[0].tasks[0].labels?.map((label) => label.id)).toEqual([
    "current-1",
    "current-2",
  ]);
});
it("compares related revisions within each task page", async () => {
  publicRequest.mockImplementation(
    async ({ query }: { query: { page: string; relatedPage?: string } }) => {
      const board = data(Number(query.page));
      return Response.json({
        ...board,
        pagination: {
          page: Number(query.page),
          pageSize: 100,
          total: 201,
          totalPages: 3,
          relatedTotalPages: 2,
          revision: "stable tasks",
          relatedRevision: `stable page ${query.page}`,
        },
      });
    },
  );
  const board = await getPublicProject({ id: "project" });
  expect(publicRequest).toHaveBeenCalledTimes(6);
  expect(board.columns[0].tasks).toHaveLength(3);
});

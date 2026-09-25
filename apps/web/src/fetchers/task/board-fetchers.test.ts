import { beforeEach, describe, expect, it, vi } from "vitest";
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

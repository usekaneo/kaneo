import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import getSprints from "./get-sprints";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("@kaneo/libs", () => ({
  client: { sprint: { ":projectId": { $get: request } } },
}));

const sprints = [
  {
    id: "sprint-1",
    projectId: "project-1",
    name: "Sprint 1",
    goal: null,
    status: "active",
    startDate: "2025-01-15",
    endDate: "2025-01-29",
    carryOverTasks: null,
    position: 0,
    taskCount: 5,
    completedTaskCount: 2,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
];

beforeEach(() => {
  request.mockReset();
});

describe("getSprints fetcher", () => {
  it("fetches the sprint list of a project", async () => {
    request.mockResolvedValueOnce(Response.json(sprints));

    const result = await getSprints("project-1");

    expect(result).toEqual(sprints);
    expect(request).toHaveBeenCalledWith({
      param: { projectId: "project-1" },
    });
  });

  it("throws an HttpError carrying the API status", async () => {
    request.mockResolvedValueOnce(
      Response.json({ message: "Project not found" }, { status: 404 }),
    );

    await expect(getSprints("missing")).rejects.toMatchObject({
      status: 404,
      message: "Project not found",
    });
  });
});

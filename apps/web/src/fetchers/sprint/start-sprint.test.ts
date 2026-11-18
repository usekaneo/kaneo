import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import startSprint from "./start-sprint";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("@kaneo/libs", () => ({
  client: { sprint: { start: { ":id": { $post: request } } } },
}));

const started = {
  id: "sprint-1",
  projectId: "project-1",
  name: "Sprint 1",
  goal: null,
  status: "active",
  startDate: "2025-01-15",
  endDate: "2025-01-29",
  carryOverTasks: null,
  position: 1,
  taskCount: 0,
  completedTaskCount: 0,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-15T00:00:00.000Z",
};

beforeEach(() => {
  request.mockReset();
});

describe("startSprint fetcher", () => {
  it("posts the sprint start with the chosen date range", async () => {
    request.mockResolvedValueOnce(Response.json(started));

    const result = await startSprint("sprint-1", {
      startDate: "2025-01-15",
      endDate: "2025-01-29",
    });

    expect(result).toEqual(started);
    expect(request).toHaveBeenCalledWith({
      param: { id: "sprint-1" },
      json: { startDate: "2025-01-15", endDate: "2025-01-29" },
    });
  });

  it("sends an empty body when no date range is chosen", async () => {
    request.mockResolvedValueOnce(Response.json(started));

    await startSprint("sprint-1");

    expect(request).toHaveBeenCalledWith({
      param: { id: "sprint-1" },
      json: {},
    });
  });

  it("throws an HttpError when another sprint is already active", async () => {
    request.mockResolvedValueOnce(
      Response.json(
        {
          message:
            'Sprint "Sprint 1" is already active. Close it before starting another sprint.',
        },
        { status: 409 },
      ),
    );

    await expect(startSprint("sprint-2")).rejects.toMatchObject({
      status: 409,
      message:
        'Sprint "Sprint 1" is already active. Close it before starting another sprint.',
    });
  });
});

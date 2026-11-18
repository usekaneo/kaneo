import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import updateSprint from "./update-sprint";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("@kaneo/libs", () => ({
  client: { sprint: { ":id": { $put: request } } },
}));

const updated = {
  id: "sprint-1",
  projectId: "project-1",
  name: "Sprint 1",
  goal: "Ship the export",
  status: "future",
  startDate: "2025-01-15",
  endDate: null,
  carryOverTasks: null,
  position: 1,
  taskCount: 0,
  completedTaskCount: 0,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-02T00:00:00.000Z",
};

beforeEach(() => {
  request.mockReset();
});

describe("updateSprint fetcher", () => {
  it("puts only the provided fields and returns the updated sprint", async () => {
    request.mockResolvedValueOnce(Response.json(updated));

    const result = await updateSprint("sprint-1", { goal: "Ship the export" });

    expect(result).toEqual(updated);
    expect(request).toHaveBeenCalledWith({
      param: { id: "sprint-1" },
      json: { goal: "Ship the export" },
    });
  });

  it("throws an HttpError carrying the API status and message", async () => {
    request.mockResolvedValueOnce(
      Response.json(
        {
          message:
            "Closed sprints are immutable. Their tasks stay as the history of what was implemented.",
        },
        { status: 409 },
      ),
    );

    await expect(
      updateSprint("sprint-1", { name: "Renamed" }),
    ).rejects.toMatchObject({
      status: 409,
      message:
        "Closed sprints are immutable. Their tasks stay as the history of what was implemented.",
    });
  });
});

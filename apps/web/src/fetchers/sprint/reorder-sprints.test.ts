import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import reorderSprints from "./reorder-sprints";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("@kaneo/libs", () => ({
  client: { sprint: { reorder: { ":projectId": { $post: request } } } },
}));

const ordered = [
  { id: "sprint-2", position: 0 },
  { id: "sprint-1", position: 1 },
];

beforeEach(() => {
  request.mockReset();
});

describe("reorderSprints fetcher", () => {
  it("posts the new sprint order for the project", async () => {
    request.mockResolvedValueOnce(Response.json(ordered));

    const result = await reorderSprints("project-1", [
      { id: "sprint-2", position: 0 },
      { id: "sprint-1", position: 1 },
    ]);

    expect(result).toEqual(ordered);
    expect(request).toHaveBeenCalledWith({
      param: { projectId: "project-1" },
      json: { sprints: ordered },
    });
  });

  it("throws an HttpError when a sprint cannot be reordered", async () => {
    request.mockResolvedValueOnce(
      Response.json(
        {
          message:
            "Sprint sprint-1 does not exist in this project, or is not a future sprint",
        },
        { status: 400 },
      ),
    );

    await expect(
      reorderSprints("project-1", [{ id: "sprint-1", position: 0 }]),
    ).rejects.toMatchObject({
      status: 400,
      message:
        "Sprint sprint-1 does not exist in this project, or is not a future sprint",
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const mockTxSet = vi.fn();
const mockTxReturning = vi.fn();
const mockPublishEvent = vi.fn();
const mockGetSprintList = vi.fn();

vi.mock("../../database", () => ({
  default: {
    // Reordering writes every new position inside one transaction; the
    // tx mock records the written position and replays the update verdict.
    transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        update: () => ({
          set: (values: Record<string, unknown>) => {
            mockTxSet(values);
            return {
              where: () => ({
                returning: () => mockTxReturning(values),
              }),
            };
          },
        }),
      }),
  },
}));

vi.mock("../../events", () => ({ publishEvent: mockPublishEvent }));

vi.mock("./get-sprints", () => ({
  getSprint: vi.fn(),
  getSprintList: mockGetSprintList,
  default: vi.fn(),
}));

import reorderSprints from "./reorder-sprints";

beforeEach(() => {
  mockTxSet.mockReset();
  mockTxReturning.mockReset();
  mockPublishEvent.mockReset();
  mockGetSprintList.mockReset();
});

describe("reorderSprints", () => {
  it("writes every new position in one transaction and republishes the list", async () => {
    mockTxReturning
      .mockResolvedValueOnce([{ id: "sprint-1" }])
      .mockResolvedValueOnce([{ id: "sprint-2" }]);
    const list = [{ id: "sprint-1" }, { id: "sprint-2" }];
    mockGetSprintList.mockResolvedValueOnce(list);
    mockPublishEvent.mockResolvedValueOnce(undefined);

    const result = await reorderSprints("project-1", [
      { id: "sprint-2", position: 0 },
      { id: "sprint-1", position: 1 },
    ]);

    expect(result).toBe(list);
    expect(mockTxSet.mock.calls).toEqual([[{ position: 0 }], [{ position: 1 }]]);
    expect(mockPublishEvent).toHaveBeenCalledWith("sprint.updated", {
      projectId: "project-1",
    });
  });

  it("rejects a sprint that is not in the project or not future with 400", async () => {
    mockTxReturning
      .mockResolvedValueOnce([{ id: "sprint-1" }])
      .mockResolvedValueOnce([]);

    await expect(
      reorderSprints("project-1", [
        { id: "sprint-1", position: 0 },
        { id: "sprint-9", position: 1 },
      ]),
    ).rejects.toMatchObject({
      status: 400,
      message:
        "Sprint sprint-9 does not exist in this project, or is not a future sprint",
    });
    expect(mockPublishEvent).not.toHaveBeenCalled();
    expect(mockGetSprintList).not.toHaveBeenCalled();
  });
});

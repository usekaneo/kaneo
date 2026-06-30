import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFindFirst = vi.fn();
const mockSelect = vi.fn();
const mockDelete = vi.fn();
const mockPublishEvent = vi.fn();
const mockRemoveLabelFromGitHub = vi.fn();
const mockRemoveLabelFromGitea = vi.fn();

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    query: {
      labelTable: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
    select: (...args: unknown[]) => mockSelect(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

vi.mock("../../../apps/api/src/events", () => ({
  publishEvent: (...args: unknown[]) => mockPublishEvent(...args),
}));

vi.mock(
  "../../../apps/api/src/plugins/github/utils/sync-label-to-github",
  () => ({
    removeLabelFromGitHub: (...args: unknown[]) =>
      mockRemoveLabelFromGitHub(...args),
  }),
);

vi.mock(
  "../../../apps/api/src/plugins/gitea/utils/sync-label-to-gitea",
  () => ({
    removeLabelFromGitea: (...args: unknown[]) =>
      mockRemoveLabelFromGitea(...args),
  }),
);

import deleteLabel from "../../../apps/api/src/label/controllers/delete-label";

const WORKSPACE_LABEL = {
  id: "label-ws-1",
  name: "bug",
  color: "EF4444",
  createdAt: new Date(),
  updatedAt: new Date(),
  taskId: null,
  workspaceId: "ws-1",
};

const DELETED_WORKSPACE_LABEL = { ...WORKSPACE_LABEL };

const TASK_LABEL_1 = {
  id: "label-task-1",
  name: "bug",
  color: "EF4444",
  createdAt: new Date(),
  updatedAt: new Date(),
  taskId: "task-1",
  workspaceId: "ws-1",
};

const TASK_LABEL_2 = {
  id: "label-task-2",
  name: "bug",
  color: "EF4444",
  createdAt: new Date(),
  updatedAt: new Date(),
  taskId: "task-2",
  workspaceId: "ws-1",
};

/**
 * Build a mock chain for `db.select().from().innerJoin().innerJoin().where()`.
 * The terminal `.where()` returns a Promise resolved to `rows`.
 */
function makeSelectMock(rows: unknown[]) {
  const chain: Record<string, vi.Mock> = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => Promise.resolve(rows)),
  };
  return chain;
}

/**
 * Build a mock chain for `db.delete().where().returning()` and
 * `db.delete().where()` (no returning).
 *
 * - `.where()` returns a sub-chain that supports `.returning()` and is thenable.
 */
function makeDeleteMock(deletedRow: unknown) {
  const chain: Record<string, vi.Mock> = {};

  // Sub-chain returned by .where():
  // - Native Promise.then so `await db.delete().where(...)` works
  // - .returning() attached for the returning-delete path
  const whereResult = Object.assign(Promise.resolve(undefined), {
    returning: vi.fn(() => Promise.resolve([deletedRow])),
  });

  chain.where = vi.fn(() => whereResult);

  return chain;
}

describe("deleteLabel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("workspace-level label deletion (taskId is null)", () => {
    it("emits task.label_deleted events for each affected task-level label", async () => {
      mockRemoveLabelFromGitHub.mockResolvedValue(undefined);
      mockRemoveLabelFromGitea.mockResolvedValue(undefined);
      mockFindFirst.mockResolvedValue(WORKSPACE_LABEL);
      mockSelect.mockReturnValue(
        makeSelectMock([
          {
            label: TASK_LABEL_1,
            taskId: "task-1",
            projectId: "proj-1",
            workspaceId: "ws-1",
          },
          {
            label: TASK_LABEL_2,
            taskId: "task-2",
            projectId: "proj-2",
            workspaceId: "ws-1",
          },
        ]),
      );
      mockDelete.mockReturnValue(makeDeleteMock(DELETED_WORKSPACE_LABEL));

      await deleteLabel("label-ws-1", "user-1");

      expect(mockPublishEvent).toHaveBeenCalledTimes(2);
      expect(mockPublishEvent).toHaveBeenCalledWith("task.label_deleted", {
        label: TASK_LABEL_1,
        task: { id: "task-1", projectId: "proj-1" },
        projectId: "proj-1",
        taskId: "task-1",
        userId: "user-1",
        type: "label_deleted",
      });
      expect(mockPublishEvent).toHaveBeenCalledWith("task.label_deleted", {
        label: TASK_LABEL_2,
        task: { id: "task-2", projectId: "proj-2" },
        projectId: "proj-2",
        taskId: "task-2",
        userId: "user-1",
        type: "label_deleted",
      });
    });

    it("calls removeLabelFromGitHub and removeLabelFromGitea for each affected task", async () => {
      mockRemoveLabelFromGitHub.mockResolvedValue(undefined);
      mockRemoveLabelFromGitea.mockResolvedValue(undefined);
      mockFindFirst.mockResolvedValue(WORKSPACE_LABEL);
      mockSelect.mockReturnValue(
        makeSelectMock([
          {
            label: TASK_LABEL_1,
            taskId: "task-1",
            projectId: "proj-1",
            workspaceId: "ws-1",
          },
          {
            label: TASK_LABEL_2,
            taskId: "task-2",
            projectId: "proj-2",
            workspaceId: "ws-1",
          },
        ]),
      );
      mockDelete.mockReturnValue(makeDeleteMock(DELETED_WORKSPACE_LABEL));

      await deleteLabel("label-ws-1", "user-1");

      expect(mockRemoveLabelFromGitHub).toHaveBeenCalledTimes(2);
      expect(mockRemoveLabelFromGitHub).toHaveBeenCalledWith("task-1", "bug");
      expect(mockRemoveLabelFromGitHub).toHaveBeenCalledWith("task-2", "bug");

      expect(mockRemoveLabelFromGitea).toHaveBeenCalledTimes(2);
      expect(mockRemoveLabelFromGitea).toHaveBeenCalledWith("task-1", "bug");
      expect(mockRemoveLabelFromGitea).toHaveBeenCalledWith("task-2", "bug");
    });

    it("fires no events when no task-level labels are affected", async () => {
      mockRemoveLabelFromGitHub.mockResolvedValue(undefined);
      mockRemoveLabelFromGitea.mockResolvedValue(undefined);
      mockFindFirst.mockResolvedValue(WORKSPACE_LABEL);
      mockSelect.mockReturnValue(makeSelectMock([]));
      mockDelete.mockReturnValue(makeDeleteMock(DELETED_WORKSPACE_LABEL));

      await deleteLabel("label-ws-1", "user-1");

      expect(mockPublishEvent).not.toHaveBeenCalled();
      expect(mockRemoveLabelFromGitHub).not.toHaveBeenCalled();
      expect(mockRemoveLabelFromGitea).not.toHaveBeenCalled();
    });
  });
});

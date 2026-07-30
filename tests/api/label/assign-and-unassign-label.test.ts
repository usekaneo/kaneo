import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

const mockFindFirst = vi.fn();
const mockSelect = vi.fn();
const mockDelete = vi.fn();
const mockInsert = vi.fn();
const mockPublishEvent = vi.fn();
const mockRemoveLabelFromGitHub = vi.fn();
const mockRemoveLabelFromGitea = vi.fn();
const mockSyncLabelToGitHub = vi.fn();
const mockSyncLabelToGitea = vi.fn();

function createMockTxContext() {
  return {
    insert: (...args: unknown[]) => mockInsert(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    query: {
      labelTable: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
  };
}

const mockTransaction = vi.fn(async (cb: (tx: unknown) => unknown) =>
  cb(createMockTxContext()),
);

vi.mock("../../../apps/api/src/database", () => ({
  default: {
    query: {
      labelTable: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
    select: (...args: unknown[]) => mockSelect(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    transaction: (...args: unknown[]) => mockTransaction(...args),
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
    syncLabelToGitHub: (...args: unknown[]) => mockSyncLabelToGitHub(...args),
  }),
);

vi.mock(
  "../../../apps/api/src/plugins/gitea/utils/sync-label-to-gitea",
  () => ({
    removeLabelFromGitea: (...args: unknown[]) =>
      mockRemoveLabelFromGitea(...args),
    syncLabelToGitea: (...args: unknown[]) => mockSyncLabelToGitea(...args),
  }),
);

import assignLabelToTask from "../../../apps/api/src/label/controllers/assign-label-to-task";
import unassignLabelFromTask from "../../../apps/api/src/label/controllers/unassign-label-from-task";

const WORKSPACE_LABEL = {
  id: "label-ws-1",
  name: "bug",
  color: "EF4444",
  createdAt: new Date(),
  updatedAt: new Date(),
  taskId: null,
  workspaceId: "ws-1",
};

const TASK_LABEL = {
  id: "label-task-1",
  name: "bug",
  color: "EF4444",
  createdAt: new Date(),
  updatedAt: new Date(),
  taskId: "task-1",
  workspaceId: "ws-1",
};

const TASK = {
  id: "task-1",
  projectId: "proj-1",
  workspaceId: "ws-1",
};

function makeSelectMock(rows: unknown[]) {
  const chain: Record<string, Mock> = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(rows)),
  };
  return chain;
}

function makeDeleteMock(deletedRow: unknown) {
  const whereResult = Object.assign(Promise.resolve(undefined), {
    returning: vi.fn(() => Promise.resolve([deletedRow])),
  });
  return {
    where: vi.fn(() => whereResult),
  };
}

function makeInsertMock(insertedRow: unknown) {
  const onConflictResult = Object.assign(Promise.resolve(undefined), {
    returning: vi.fn(() => Promise.resolve([insertedRow])),
  });
  const onConflict = vi.fn(() => onConflictResult);
  const values = vi.fn(() => ({ onConflictDoNothing: onConflict }));
  return { values, onConflict };
}

describe("unassignLabelFromTask", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb(createMockTxContext()),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes the task assignment instead of nulling taskId", async () => {
    mockFindFirst.mockResolvedValue(TASK_LABEL);
    mockSelect.mockReturnValue(makeSelectMock([TASK]));
    mockDelete.mockReturnValue(makeDeleteMock(TASK_LABEL));
    mockRemoveLabelFromGitHub.mockResolvedValue(undefined);

    await unassignLabelFromTask("label-task-1", "user-1");

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockPublishEvent).toHaveBeenCalledWith("task.label_unassigned", {
      label: TASK_LABEL,
      task: TASK,
      projectId: TASK.projectId,
      taskId: TASK_LABEL.taskId,
      userId: "user-1",
      type: "label_unassigned",
    });
  });

  it("calls removeLabelFromGitHub with the deleted task's id and name", async () => {
    mockFindFirst.mockResolvedValue(TASK_LABEL);
    mockSelect.mockReturnValue(makeSelectMock([TASK]));
    mockDelete.mockReturnValue(makeDeleteMock(TASK_LABEL));
    mockRemoveLabelFromGitHub.mockResolvedValue(undefined);

    await unassignLabelFromTask("label-task-1", "user-1");

    expect(mockRemoveLabelFromGitHub).toHaveBeenCalledWith("task-1", "bug");
  });

  it("rejects when the label is a workspace definition (taskId is null)", async () => {
    mockFindFirst.mockResolvedValue(WORKSPACE_LABEL);

    await expect(
      unassignLabelFromTask("label-ws-1", "user-1"),
    ).rejects.toMatchObject({
      status: 400,
    });
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });
});

describe("assignLabelToTask", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb(createMockTxContext()),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a task-level copy without mutating the workspace definition", async () => {
    mockFindFirst.mockResolvedValue(WORKSPACE_LABEL);
    mockSelect.mockReturnValue(makeSelectMock([TASK]));
    const insertedCopy = { ...TASK_LABEL, id: "label-task-2" };
    const insertChain = makeInsertMock(insertedCopy);
    mockInsert.mockReturnValue(insertChain);
    mockSyncLabelToGitHub.mockResolvedValue(undefined);
    mockSyncLabelToGitea.mockResolvedValue(undefined);

    const result = await assignLabelToTask("label-ws-1", "task-1", "user-1");

    expect(result).toEqual(insertedCopy);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockDelete).not.toHaveBeenCalled();
    expect(insertChain.onConflict).toHaveBeenCalledWith({
      target: [expect.anything(), expect.anything()],
    });
    expect(mockPublishEvent).toHaveBeenCalledWith("task.label_assigned", {
      label: insertedCopy,
      task: TASK,
      projectId: TASK.projectId,
      taskId: TASK.id,
      userId: "user-1",
      type: "label_assigned",
    });
    expect(mockSyncLabelToGitHub).toHaveBeenCalledWith(
      "task-1",
      "bug",
      "EF4444",
    );
    expect(mockSyncLabelToGitea).toHaveBeenCalledWith(
      "task-1",
      "bug",
      "EF4444",
    );
  });

  it("is idempotent when the same label is already attached to the same task", async () => {
    mockFindFirst.mockResolvedValueOnce({ ...TASK_LABEL, taskId: "task-1" });
    mockSelect.mockReturnValue(makeSelectMock([TASK]));

    const result = await assignLabelToTask("label-task-1", "task-1", "user-1");

    expect(result).toEqual({ ...TASK_LABEL, taskId: "task-1" });
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it("removes the stale task copy when moving the label to a different task", async () => {
    const stale = { ...TASK_LABEL, taskId: "task-old" };
    mockFindFirst.mockResolvedValue(stale);
    mockSelect.mockReturnValue(makeSelectMock([TASK]));
    mockDelete.mockReturnValue(makeDeleteMock(stale));
    const insertedCopy = { ...TASK_LABEL, id: "label-task-2" };
    const insertChain = makeInsertMock(insertedCopy);
    mockInsert.mockReturnValue(insertChain);
    mockRemoveLabelFromGitHub.mockResolvedValue(undefined);
    mockRemoveLabelFromGitea.mockResolvedValue(undefined);
    mockSyncLabelToGitHub.mockResolvedValue(undefined);
    mockSyncLabelToGitea.mockResolvedValue(undefined);

    await assignLabelToTask("label-task-1", "task-1", "user-1");

    expect(mockRemoveLabelFromGitHub).toHaveBeenCalledWith("task-old", "bug");
    expect(mockRemoveLabelFromGitea).toHaveBeenCalledWith("task-old", "bug");
    expect(mockSyncLabelToGitHub).toHaveBeenCalledWith(
      "task-1",
      "bug",
      "EF4444",
    );
    expect(mockPublishEvent).toHaveBeenCalledWith(
      "task.label_assigned",
      expect.objectContaining({
        taskId: "task-1",
      }),
    );
  });

  it("is idempotent when the workspace label is re-attached to the same task", async () => {
    mockFindFirst.mockResolvedValueOnce(WORKSPACE_LABEL);
    mockSelect.mockReturnValue(makeSelectMock([TASK]));
    const insertChain = makeInsertMock(undefined);
    mockInsert.mockReturnValue(insertChain);
    mockFindFirst.mockResolvedValueOnce(WORKSPACE_LABEL);
    mockFindFirst.mockResolvedValueOnce(TASK_LABEL);

    const result = await assignLabelToTask("label-ws-1", "task-1", "user-1");

    expect(result).toEqual(TASK_LABEL);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockSyncLabelToGitHub).not.toHaveBeenCalled();
    expect(mockSyncLabelToGitea).not.toHaveBeenCalled();
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it("falls back to the existing task label when the workspace insert returns no row", async () => {
    mockFindFirst.mockResolvedValueOnce(WORKSPACE_LABEL);
    mockSelect.mockReturnValue(makeSelectMock([TASK]));
    const insertChain = makeInsertMock(undefined);
    mockInsert.mockReturnValue(insertChain);
    mockFindFirst.mockResolvedValueOnce(WORKSPACE_LABEL);
    mockFindFirst.mockResolvedValueOnce(WORKSPACE_LABEL);

    await assignLabelToTask("label-ws-1", "task-1", "user-1");

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockFindFirst).toHaveBeenCalledTimes(3);
  });

  it("throws HTTP 500 when the insert and fallback lookup both return no row", async () => {
    mockFindFirst.mockResolvedValueOnce(WORKSPACE_LABEL);
    mockSelect.mockReturnValue(makeSelectMock([TASK]));
    const insertChain = makeInsertMock(undefined);
    mockInsert.mockReturnValue(insertChain);
    mockFindFirst.mockResolvedValueOnce(WORKSPACE_LABEL);
    mockFindFirst.mockResolvedValueOnce(undefined);

    await expect(
      assignLabelToTask("label-ws-1", "task-1", "user-1"),
    ).rejects.toMatchObject({
      status: 500,
    });

    expect(mockSyncLabelToGitHub).not.toHaveBeenCalled();
    expect(mockSyncLabelToGitea).not.toHaveBeenCalled();
    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it("throws HTTP 404 when the label is removed before the transaction begins", async () => {
    mockFindFirst.mockResolvedValueOnce(WORKSPACE_LABEL);
    mockFindFirst.mockResolvedValueOnce(undefined);
    mockSelect.mockReturnValue(makeSelectMock([TASK]));

    await expect(
      assignLabelToTask("label-ws-1", "task-1", "user-1"),
    ).rejects.toMatchObject({
      status: 404,
    });

    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { useBulkRequestStore } from "@/components/bulk-selection/bulk-request-store";
import { shortcutRegistry } from "@/lib/shortcuts/registry";
import { ShortcutTestWrapper } from "@/lib/shortcuts/shortcut-test-wrapper";
import useBulkSelectionStore from "@/store/bulk-selection";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import { useTaskActionShortcuts } from "./use-task-action-shortcuts";

const mocks = vi.hoisted(() => ({
  bulkAssign: vi.fn(),
  bulkDueDate: vi.fn(),
  writeText: vi.fn(),
  message: vi.fn(),
  error: vi.fn(),
  canUpdateTasks: vi.fn(),
  canAssignTasks: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ getQueryData: () => [] }),
}));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: { id: "user-1" } }),
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "workspace-1", slug: "acme" } }),
}));
vi.mock("@/hooks/mutations/task/use-bulk-operations", () => ({
  useBulkOperations: () => ({
    bulkAssign: mocks.bulkAssign,
    bulkDueDate: mocks.bulkDueDate,
  }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canUpdateTasks: mocks.canUpdateTasks,
    canAssignTasks: mocks.canAssignTasks,
    canDeleteTasks: () => true,
    canUpdateLabels: () => true,
  }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { message: mocks.message, error: mocks.error },
}));

const task = (id: string, number: number) => ({
  id,
  number,
  title: `Task ${number}`,
  projectId: "project-1",
});

function Harness() {
  useTaskActionShortcuts(useBulkSelectionStore);
  return null;
}

const press = (init: KeyboardEventInit) =>
  fireEvent.keyDown(document.body, init);
const selection = () => useBulkSelectionStore.getState();

beforeEach(() => {
  mocks.canUpdateTasks.mockReturnValue(true);
  mocks.canAssignTasks.mockReturnValue(true);
  mocks.bulkAssign.mockResolvedValue(undefined);
  mocks.bulkDueDate.mockResolvedValue(undefined);
  mocks.writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: mocks.writeText },
  });
  useProjectStore.getState().setProject({
    id: "project-1",
    slug: "KAN",
    workspaceId: "workspace-1",
    columns: [{ id: "todo", tasks: [task("a", 1), task("b", 2)] }],
    plannedTasks: [task("c", 3)],
    archivedTasks: [],
  } as unknown as ProjectWithTasks);
  render(
    <ShortcutTestWrapper>
      <Harness />
    </ShortcutTestWrapper>,
  );
});

afterEach(() => {
  cleanup();
  shortcutRegistry.reset();
  selection().clearSelection();
  selection().clearFocus();
  useBulkRequestStore.setState({ request: null, temporaryTaskId: null });
  vi.clearAllMocks();
});

describe("useTaskActionShortcuts", () => {
  it("opens the status picker for the focused task as a temporary selection", () => {
    act(() => selection().setFocusedTask("a"));

    press({ key: "s", code: "KeyS" });

    expect(selection().selectedTaskIds).toEqual(new Set(["a"]));
    expect(useBulkRequestStore.getState()).toMatchObject({
      request: "status",
      temporaryTaskId: "a",
    });
  });

  it("keeps an existing selection as the target", () => {
    act(() => {
      selection().selectTasks(["a", "b"]);
      selection().setFocusedTask("c");
    });

    press({ key: "p", code: "KeyP" });

    expect(selection().selectedTaskIds).toEqual(new Set(["a", "b"]));
    expect(useBulkRequestStore.getState()).toMatchObject({
      request: "priority",
      temporaryTaskId: null,
    });
  });

  it("does nothing without a focused or selected task", () => {
    press({ key: "s", code: "KeyS" });

    expect(useBulkRequestStore.getState().request).toBeNull();
  });

  it("assigns the selection to the current user and clears it", async () => {
    act(() => selection().selectTasks(["a", "b"]));

    press({ key: "i", code: "KeyI" });
    await act(async () => {});

    expect(mocks.bulkAssign).toHaveBeenCalledWith({
      taskIds: ["a", "b"],
      userId: "user-1",
    });
    expect(selection().selectedTaskIds.size).toBe(0);
  });

  it("removes the due date of the focused task without selecting it", async () => {
    act(() => selection().setFocusedTask("c"));

    press({ key: "D", code: "KeyD", ctrlKey: true, shiftKey: true });
    await act(async () => {});

    expect(mocks.bulkDueDate).toHaveBeenCalledWith({
      taskIds: ["c"],
      dueDate: null,
    });
    expect(selection().selectedTaskIds.size).toBe(0);
  });

  it("respects edit and assign permissions", () => {
    cleanup();
    mocks.canUpdateTasks.mockReturnValue(false);
    mocks.canAssignTasks.mockReturnValue(false);
    render(
      <ShortcutTestWrapper>
        <Harness />
      </ShortcutTestWrapper>,
    );
    act(() => selection().setFocusedTask("a"));

    press({ key: "s", code: "KeyS" });
    press({ key: "i", code: "KeyI" });

    expect(useBulkRequestStore.getState().request).toBeNull();
    expect(mocks.bulkAssign).not.toHaveBeenCalled();
  });

  it("copies the focused task's ID and title", async () => {
    act(() => selection().setFocusedTask("b"));

    press({ key: ".", code: "Period", ctrlKey: true });
    press({ key: '"', code: "Quote", ctrlKey: true, shiftKey: true });
    await act(async () => {});

    expect(mocks.writeText.mock.calls).toEqual([["KAN-2"], ["Task 2"]]);
  });
});

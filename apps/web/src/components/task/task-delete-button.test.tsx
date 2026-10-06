import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { AlertDialogCreateHandle } from "@/components/ui/alert-dialog";
import { KeyboardShortcutsProvider } from "@/hooks/use-keyboard-shortcuts";
import TaskDeleteButton from "./task-delete-button";
import TaskDeleteDialog from "./task-delete-dialog";

const mocks = vi.hoisted(() => ({
  canDeleteTasks: vi.fn(),
  deleteTask: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/mutations/task/use-delete-task", () => ({
  useDeleteTask: () => ({
    mutateAsync: mocks.deleteTask,
    isPending: false,
  }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canDeleteTasks: mocks.canDeleteTasks,
    isCheckingPermissions: false,
  }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { error: mocks.error, success: mocks.success },
}));

function renderTaskDelete({
  onDeleted = vi.fn(),
  shortcutEnabled,
}: { onDeleted?: () => void; shortcutEnabled?: boolean } = {}) {
  const handle = AlertDialogCreateHandle();
  const renderView = (taskId: string) => (
    <KeyboardShortcutsProvider>
      <TaskDeleteButton handle={handle} />
      <TaskDeleteDialog
        handle={handle}
        taskId={taskId}
        onDeleted={onDeleted}
        shortcutEnabled={shortcutEnabled}
      />
    </KeyboardShortcutsProvider>
  );
  const { rerender } = render(renderView("task-1"));
  return {
    onDeleted,
    switchTask: (taskId: string) => rerender(renderView(taskId)),
  };
}

async function confirmDeletion() {
  const deleteButtons = await screen.findAllByRole("button", {
    name: "tasks:delete.action",
  });
  fireEvent.click(deleteButtons.at(-1) as HTMLButtonElement);
}

beforeEach(() => {
  mocks.canDeleteTasks.mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TaskDeleteButton", () => {
  it("is only available to users with task deletion permission", async () => {
    mocks.canDeleteTasks.mockReturnValue(false);
    renderTaskDelete();

    fireEvent.keyDown(document, { key: "Backspace", ctrlKey: true });

    expect(
      screen.queryByRole("button", { name: "tasks:delete.action" }),
    ).toBeNull();
    await waitFor(() =>
      expect(screen.queryByText("tasks:delete.title")).toBeNull(),
    );
  });

  it("deletes after confirmation and reports success", async () => {
    mocks.deleteTask.mockResolvedValue({ id: "task-1" });
    const { onDeleted } = renderTaskDelete();

    fireEvent.click(
      screen.getByRole("button", { name: "tasks:delete.action" }),
    );
    await confirmDeletion();

    await waitFor(() =>
      expect(mocks.deleteTask).toHaveBeenCalledWith("task-1"),
    );
    expect(mocks.success).toHaveBeenCalledWith("tasks:delete.success");
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it("opens the confirmation from the keyboard shortcut", async () => {
    mocks.deleteTask.mockResolvedValue({ id: "task-1" });
    renderTaskDelete();

    fireEvent.keyDown(document, { key: "Backspace", ctrlKey: true });

    expect(await screen.findByText("tasks:delete.title")).toBeTruthy();
    expect(mocks.deleteTask).not.toHaveBeenCalled();
  });

  it.each([
    ["an input", () => document.createElement("input")],
    ["a textarea", () => document.createElement("textarea")],
    [
      "the task editor",
      () => {
        const editor = document.createElement("div");
        editor.contentEditable = "true";
        return editor;
      },
    ],
  ])("ignores the shortcut while typing in %s", async (_, createField) => {
    renderTaskDelete();
    const field = createField();
    document.body.append(field);

    try {
      field.focus();
      fireEvent.keyDown(field, { key: "Backspace", ctrlKey: true });
      await act(async () => {});
    } finally {
      field.remove();
    }

    expect(screen.queryByText("tasks:delete.title")).toBeNull();
  });

  it("leaves the shortcut off while the view has it disabled", async () => {
    renderTaskDelete({ shortcutEnabled: false });

    fireEvent.keyDown(document, { key: "Backspace", ctrlKey: true });
    await act(async () => {});

    expect(screen.queryByText("tasks:delete.title")).toBeNull();
  });

  it("closes the confirmation when the view switches to another task", async () => {
    const { switchTask } = renderTaskDelete();

    fireEvent.keyDown(document, { key: "Backspace", ctrlKey: true });
    expect(await screen.findByText("tasks:delete.title")).toBeTruthy();

    switchTask("task-2");

    await waitFor(() =>
      expect(screen.queryByText("tasks:delete.title")).toBeNull(),
    );
    expect(mocks.deleteTask).not.toHaveBeenCalled();
  });

  it("keeps the current view open and reports a failed deletion", async () => {
    mocks.deleteTask.mockRejectedValue(new Error("Delete denied"));
    const { onDeleted } = renderTaskDelete();

    fireEvent.click(
      screen.getByRole("button", { name: "tasks:delete.action" }),
    );
    await confirmDeletion();

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith("Delete denied"),
    );
    expect(mocks.success).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});

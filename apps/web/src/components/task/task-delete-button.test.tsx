import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TaskDeleteButton from "./task-delete-button";

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

beforeEach(() => {
  mocks.canDeleteTasks.mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TaskDeleteButton", () => {
  it("is only shown to users with task deletion permission", () => {
    mocks.canDeleteTasks.mockReturnValue(false);

    render(<TaskDeleteButton taskId="task-1" onDeleted={vi.fn()} />);

    expect(
      screen.queryByRole("button", { name: "tasks:delete.action" }),
    ).toBeNull();
  });

  it("deletes after confirmation and reports success", async () => {
    const onDeleted = vi.fn();
    mocks.deleteTask.mockResolvedValue({ id: "task-1" });
    render(<TaskDeleteButton taskId="task-1" onDeleted={onDeleted} />);

    fireEvent.click(
      screen.getByRole("button", { name: "tasks:delete.action" }),
    );
    const deleteButtons = await screen.findAllByRole("button", {
      name: "tasks:delete.action",
    });
    fireEvent.click(deleteButtons.at(-1) as HTMLButtonElement);

    await waitFor(() =>
      expect(mocks.deleteTask).toHaveBeenCalledWith("task-1"),
    );
    expect(mocks.success).toHaveBeenCalledWith("tasks:delete.success");
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it("keeps the current view open and reports a failed deletion", async () => {
    const onDeleted = vi.fn();
    mocks.deleteTask.mockRejectedValue(new Error("Delete denied"));
    render(<TaskDeleteButton taskId="task-1" onDeleted={onDeleted} />);

    fireEvent.click(
      screen.getByRole("button", { name: "tasks:delete.action" }),
    );
    const deleteButtons = await screen.findAllByRole("button", {
      name: "tasks:delete.action",
    });
    fireEvent.click(deleteButtons.at(-1) as HTMLButtonElement);

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith("Delete denied"),
    );
    expect(mocks.success).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import type Task from "@/types/task";
import TaskStatusPopover from "./task-status-popover";

const useGetColumns = vi.fn();

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

vi.mock("@/hooks/queries/column/use-get-columns", () => ({
  useGetColumns: (projectId: string) => useGetColumns(projectId),
}));

vi.mock("@/hooks/mutations/task/use-update-task-status", () => ({
  useUpdateTaskStatus: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/use-numbered-shortcuts", () => ({
  useNumberedShortcuts: vi.fn(),
}));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canManageTasks: () => true }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const task: Task = {
  id: "task-1",
  title: "Directly loaded task",
  number: 1,
  description: null,
  status: "to-do",
  priority: null,
  startDate: null,
  dueDate: null,
  position: 1,
  createdAt: "2026-07-17T00:00:00.000Z",
  userId: null,
  assigneeId: null,
  assigneeName: null,
  projectId: "project-1",
};

describe("TaskStatusPopover", () => {
  it("loads status options for the task project without relying on board state", async () => {
    useGetColumns.mockReturnValue({
      data: [
        {
          id: "column-1",
          slug: "to-do",
          name: "Ready",
          icon: null,
          isFinal: false,
        },
      ],
      isLoading: false,
      isError: false,
    });

    render(
      <TaskStatusPopover task={task}>
        <Button>Status</Button>
      </TaskStatusPopover>,
    );

    expect(useGetColumns).toHaveBeenCalledWith("project-1");
    expect(screen.queryByRole("button", { name: /Ready/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Status" }));

    expect(await screen.findByRole("button", { name: /Ready/ })).toBeVisible();
  });

  it("shows loading feedback while status options are loading", async () => {
    useGetColumns.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(
      <TaskStatusPopover task={task}>
        <Button>Status</Button>
      </TaskStatusPopover>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Status" }));

    expect(await screen.findByText("common:empty.loading")).toBeVisible();
  });

  it("shows error feedback when status options fail to load", async () => {
    useGetColumns.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(
      <TaskStatusPopover task={task}>
        <Button>Status</Button>
      </TaskStatusPopover>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Status" }));

    expect(await screen.findByText("common:error.title")).toBeVisible();
  });
});

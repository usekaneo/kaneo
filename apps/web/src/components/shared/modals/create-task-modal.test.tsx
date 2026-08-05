import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CreateTaskModal from "./create-task-modal";

const useLocation = vi.fn();
const createTask = vi.fn(async (input: Record<string, unknown>) => ({
  id: "task-1",
  title: input.title,
  status: input.status,
  projectId: input.projectId,
  createdAt: "2026-08-05T00:00:00.000Z",
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => useLocation(),
}));

vi.mock("@/components/task/task-description-editor", () => ({
  default: () => <div data-testid="description-editor" />,
}));

vi.mock("@/hooks/mutations/label/use-create-label", () => ({
  default: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/mutations/task/use-create-task", () => ({
  default: () => ({ mutateAsync: createTask }),
}));

vi.mock("@/hooks/mutations/task/use-delete-task", () => ({
  useDeleteTask: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/mutations/task/use-update-task", () => ({
  useUpdateTask: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/queries/label/use-get-labels-by-workspace", () => ({
  default: () => ({ data: [] }),
}));

vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "workspace-1", name: "WS" } }),
}));

vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({ data: { members: [] } }),
  }),
);

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canCreateTasks: () => true,
    canManageLabels: () => true,
  }),
}));

vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({
    data: [
      { id: "project-1", name: "Alpha", slug: "alp" },
      { id: "project-2", name: "Beta", slug: "bet" },
    ],
  }),
}));

vi.mock("@/store/project", () => ({
  default: () => ({ project: null, setProject: vi.fn() }),
}));

vi.mock("@/lib/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

describe("CreateTaskModal project picker", () => {
  it("shows a project picker and creates the task in the chosen project", async () => {
    useLocation.mockReturnValue({
      pathname: "/dashboard/workspace/workspace-1",
    });

    render(<CreateTaskModal open onClose={vi.fn()} />);

    const pickerTrigger = screen.getByText(
      "common:modals.createTask.selectProject",
    );
    fireEvent.click(pickerTrigger);
    fireEvent.click(await screen.findByText("Beta"));

    fireEvent.change(
      screen.getByPlaceholderText(
        "common:modals.createTask.taskTitlePlaceholder",
      ),
      { target: { value: "Picked project task" } },
    );
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);

    await vi.waitFor(() => {
      expect(createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Picked project task",
          projectId: "project-2",
        }),
      );
    });
  });

  it("hides the picker when a project is in scope from the route", () => {
    useLocation.mockReturnValue({
      pathname: "/dashboard/workspace/workspace-1/project/project-1/board",
    });

    render(<CreateTaskModal open onClose={vi.fn()} />);

    expect(
      screen.queryByText("common:modals.createTask.selectProject"),
    ).toBeNull();
  });
});

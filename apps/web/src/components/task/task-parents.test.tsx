import {
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
import TaskParents from "./task-parents";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  remove: vi.fn(),
  canUpdate: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateTasks: mocks.canUpdate }),
}));
vi.mock("@/hooks/queries/task-relation/use-get-task-relations", () => ({
  default: () => ({
    data: [
      {
        id: "relation",
        relationType: "subtask",
        targetTaskId: "child",
        sourceTask: {
          id: "parent",
          title: "Parent task",
          projectId: "other-project",
        },
      },
    ],
  }),
}));
vi.mock("@/hooks/mutations/task-relation/use-delete-task-relation", () => ({
  default: () => ({ mutateAsync: mocks.remove, isPending: false }),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: mocks.error } }));
beforeEach(() => {
  mocks.canUpdate.mockReturnValue(true);
  mocks.remove.mockResolvedValue({});
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function renderParents() {
  render(<TaskParents taskId="child" workspaceId="workspace" />);
}
describe("TaskParents", () => {
  it("navigates using the parent's project, not the child's", () => {
    renderParents();
    fireEvent.click(screen.getByRole("button", { name: /Parent task/ }));
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        params: {
          workspaceId: "workspace",
          projectId: "other-project",
          taskId: "parent",
        },
      }),
    );
  });
  it("removes only the relation", async () => {
    renderParents();
    expect(
      screen.getByRole("button", { name: "tasks:subtasks.removeParent" }),
    ).toHaveAttribute("title", "tasks:subtasks.unlink");
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:subtasks.removeParent" }),
    );
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("relation"));
  });
  it("reports unlink errors", async () => {
    mocks.remove.mockRejectedValue(new Error("Not allowed"));
    renderParents();
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:subtasks.removeParent" }),
    );
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith("Not allowed"),
    );
  });
  it("keeps the parent visible but hides editing for read-only users", () => {
    mocks.canUpdate.mockReturnValue(false);
    renderParents();
    expect(screen.getByText("Parent task")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "tasks:subtasks.removeParent" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "tasks:subtasks.chooseParent" }),
    ).not.toBeInTheDocument();
  });
});

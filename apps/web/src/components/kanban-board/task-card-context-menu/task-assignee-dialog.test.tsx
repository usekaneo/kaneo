import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type Task from "@/types/task";
import { TaskAssigneeDialog } from "./task-assignee-dialog";
const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  refetch: vi.fn(),
  toast: vi.fn(),
  members: Array.from({ length: 50 }, (_, i) => ({
    id: `person-${i}`,
    name: `Person ${i}`,
    email: `person${i}@example.test`,
    image: null,
  })),
  loading: false,
  error: false,
}));
vi.mock("@/hooks/queries/workspace-users/use-get-project-members", () => ({
  default: () => ({
    data: mocks.members,
    isPending: mocks.loading,
    isError: mocks.error,
    refetch: mocks.refetch,
  }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-assignee", () => ({
  useUpdateTaskAssignee: () => ({
    mutateAsync: mocks.mutate,
    isPending: false,
  }),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: mocks.toast } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/i18n", () => ({ i18n: { t: (key: string) => key } }));
const task = { id: "task", projectId: "project", userId: "person-1" } as Task;
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  mocks.loading = false;
  mocks.error = false;
});
function open() {
  const onClose = vi.fn();
  render(
    <TaskAssigneeDialog
      task={task}
      workspaceId="workspace"
      onClose={onClose}
    />,
  );
  return { onClose, input: screen.getByRole("combobox") };
}
describe("assignment search opened from context menus", () => {
  it("focuses search and assigns an offscreen member by typing and Enter", async () => {
    mocks.mutate.mockResolvedValue({});
    const { input, onClose } = open();
    await waitFor(() => expect(input).toHaveFocus());
    fireEvent.change(input, { target: { value: "  pErSoN 49  " } });
    expect(screen.queryByRole("option", { name: /Person 1$/ })).toBeNull();
    expect(
      screen.getByRole("option", { name: /Person 49/ }),
    ).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(mocks.mutate).toHaveBeenCalledWith({
        ...task,
        userId: "person-49",
        assigneeMode: "add",
        assigneeIds: [],
      }),
    );
    expect(onClose).not.toHaveBeenCalled();
  });
  it("keeps Unassigned reachable while searching and clears assignment", async () => {
    const { input, onClose } = open();
    fireEvent.change(input, { target: { value: "no matching person" } });
    fireEvent.click(
      screen.getByRole("option", { name: /tasks:popover.assignee.unassigned/ }),
    );
    await waitFor(() =>
      expect(mocks.mutate).toHaveBeenCalledWith({
        ...task,
        userId: "",
        assigneeMode: "set",
        assigneeIds: [],
      }),
    );
    expect(onClose).not.toHaveBeenCalled();
  });
  it("keeps the picker open when assignment fails", async () => {
    mocks.mutate.mockRejectedValue(new Error("Assignment failed"));
    const { input, onClose } = open();
    fireEvent.change(input, { target: { value: "Person 49" } });
    fireEvent.click(screen.getByRole("option", { name: /Person 49/ }));
    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith("Assignment failed"),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(input).toHaveValue("Person 49");
  });
  it("shows loading failures with retry instead of an empty people list", () => {
    mocks.error = true;
    open();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "settings:adminWorkspaces.members.loadError",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "common:error.tryAgain" }),
    );
    expect(mocks.refetch).toHaveBeenCalledOnce();
    expect(screen.queryByRole("option")).toBeNull();
  });
  it("closes with Escape", async () => {
    const { input, onClose } = open();
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});

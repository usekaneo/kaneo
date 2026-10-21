import SubtaskAssigneePopover from "./subtask-assignee-popover";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type Task from "@/types/task";
import TaskAssigneePopover from "./task-assignee-popover";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  pending: false,
  people: [
    { id: "ada", name: "Ada", email: "ada@example.test", image: null },
    { id: "grace", name: "Grace", email: "grace@example.test", image: null },
  ],
}));
vi.mock("@/hooks/queries/workspace-users/use-get-project-members", () => ({
  default: () => ({ data: mocks.people }),
}));
vi.mock("@/hooks/queries/workspace-users/use-get-members-of-projects", () => ({
  default: () => ({ data: mocks.people }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-assignee", () => ({
  useUpdateTaskAssignee: () => ({
    mutateAsync: mocks.mutate,
    isPending: mocks.pending,
  }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canAssignTasks: () => true }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  mocks.pending = false;
});
const task: Task = {
  id: "task",
  projectId: "project",
  userId: "ada",
  assignees: [mocks.people[0]],
  title: "Shared work",
  number: 1,
  description: "",
  status: "to-do",
  priority: "medium",
  startDate: null,
  dueDate: null,
  position: 1,
  createdAt: "2026-10-21T00:00:00.000Z",
  assigneeId: "ada",
  assigneeName: "Ada",
};

function picker(value = task) {
  return (
    <TaskAssigneePopover task={value} workspaceId="workspace">
      <button type="button">Assign</button>
    </TaskAssigneePopover>
  );
}

describe("multiple-assignee picker", () => {
  it("searches by email, adds without replacing, and stays open for another selection", async () => {
    const view = render(picker());
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "GRACE@EXAMPLE.TEST" } });
    fireEvent.click(screen.getByRole("option", { name: "Grace" }));
    await waitFor(() =>
      expect(mocks.mutate).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "grace", assigneeMode: "add" }),
      ),
    );
    expect(input).toHaveValue("GRACE@EXAMPLE.TEST");
    view.rerender(picker({ ...task, assignees: mocks.people }));
    expect(screen.getByRole("listbox")).toHaveAttribute(
      "aria-multiselectable",
      "true",
    );
    expect(screen.getByRole("option", { name: "Grace" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.change(input, { target: { value: "Ada" } });
    fireEvent.click(screen.getByRole("option", { name: "Ada" }));
    await waitFor(() =>
      expect(mocks.mutate).toHaveBeenLastCalledWith(
        expect.objectContaining({ userId: "ada", assigneeMode: "remove" }),
      ),
    );
  });
  it("keeps people visible but prevents another toggle while saving", async () => {
    mocks.pending = true;
    render(picker());
    fireEvent.click(screen.getByRole("button", { name: "Assign" }));
    expect(screen.getByRole("listbox")).toHaveAttribute("aria-busy", "true");
    const grace = screen.getByRole("option", { name: "Grace" });
    expect(grace).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(grace);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
  it("shows mixed ownership without marking Unassigned and adds a person to every reference", async () => {
    const other = {
      ...task,
      id: "other",
      userId: "grace",
      assignees: [mocks.people[1]],
    };
    render(
      <SubtaskAssigneePopover tasks={[task, other]} workspaceId="workspace">
        <button type="button">Assign references</button>
      </SubtaskAssigneePopover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Assign references" }));
    expect(
      screen.getByRole("option", { name: "tasks:popover.assignee.unassigned" }),
    ).toHaveAttribute("aria-selected", "false");
    fireEvent.click(screen.getByRole("option", { name: "Ada" }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledTimes(2));
    expect(
      mocks.mutate.mock.calls.map(([value]) => ({
        id: value.id,
        mode: value.assigneeMode,
        userId: value.userId,
      })),
    ).toEqual([
      { id: "task", mode: "add", userId: "ada" },
      { id: "other", mode: "add", userId: "ada" },
    ]);
  });
});

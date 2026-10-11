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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";
import TaskLabelsContextMenu from "./task-labels-context-menu";

const mocks = vi.hoisted(() => ({
  attach: vi.fn(async () => ({})),
  detach: vi.fn(async () => ({})),
  assigned: [{ id: "clone-bug", name: "Bug", color: "crimson" }],
  pending: false,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/queries/label/use-get-labels-by-task", () => ({
  default: () => ({ data: mocks.assigned }),
}));
vi.mock("@/hooks/queries/label/use-get-labels-by-workspace", () => ({
  default: () => ({
    data: [
      { id: "template-bug", name: "Bug", color: "crimson", taskId: null },
      { id: "clone-bug", name: "Bug", color: "crimson", taskId: "task-1" },
      {
        id: "template-design",
        name: "Design",
        color: "lavender",
        taskId: null,
      },
      {
        id: "other",
        name: "Other task only",
        color: "sage",
        taskId: "other-task",
      },
    ],
  }),
}));
vi.mock("@/hooks/mutations/label/use-attach-label-to-task", () => ({
  default: () => ({ mutateAsync: mocks.attach, isPending: mocks.pending }),
}));
vi.mock("@/hooks/mutations/label/use-detach-label-from-task", () => ({
  default: () => ({ mutateAsync: mocks.detach, isPending: false }),
}));
const task = {
  id: "task-1",
  projectId: "project-1",
  title: "Task",
  number: 1,
  description: null,
  status: "to-do",
  priority: null,
  startDate: null,
  dueDate: null,
  position: 1,
  createdAt: "2026-10-09T00:00:00.000Z",
  userId: null,
  assigneeId: null,
  assigneeName: null,
} satisfies Task;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.pending = false;
});
afterEach(cleanup);

async function openMenu() {
  render(
    <ContextMenu>
      <ContextMenuTrigger>Task card</ContextMenuTrigger>
      <ContextMenuContent>
        <TaskLabelsContextMenu task={task} workspaceId="workspace-1" />
      </ContextMenuContent>
    </ContextMenu>,
  );
  fireEvent.contextMenu(screen.getByText("Task card"));
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "tasks:properties.labels" }),
  );
  await screen.findByRole("menuitemcheckbox", { name: "Design" });
}

describe("task labels context menu", () => {
  it("keeps the real menu open for multiple changes and uses assigned clone IDs when removing labels", async () => {
    await openMenu();
    expect(
      screen.getAllByRole("menuitemcheckbox", { name: "Bug" }),
    ).toHaveLength(1);
    expect(screen.queryByText("Other task only")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Design" }));
    await waitFor(() =>
      expect(mocks.attach).toHaveBeenCalledExactlyOnceWith({
        labelId: "template-design",
        taskId: "task-1",
      }),
    );
    expect(screen.getByRole("menuitemcheckbox", { name: "Bug" })).toBeVisible();
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Bug" }));
    await waitFor(() =>
      expect(mocks.detach).toHaveBeenCalledExactlyOnceWith({
        labelId: "clone-bug",
      }),
    );
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Design" }),
    ).toBeVisible();
  });

  it("keeps the menu open and reports failed changes without a success notification", async () => {
    mocks.attach.mockRejectedValueOnce(new Error("Cannot attach"));
    await openMenu();
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Design" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Cannot attach"),
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Design" }),
    ).toBeVisible();
  });

  it("disables selection while a label mutation is pending", async () => {
    mocks.pending = true;
    await openMenu();
    expect(
      screen.getByRole("menuitemcheckbox", { name: "Design" }),
    ).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByRole("menuitemcheckbox", { name: "Design" }));
    expect(mocks.attach).not.toHaveBeenCalled();
  });
});

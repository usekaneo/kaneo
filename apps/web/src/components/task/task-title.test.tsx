import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { ShortcutTestWrapper } from "@/lib/shortcuts/shortcut-test-wrapper";
import TaskTitle from "./task-title";

const mocks = vi.hoisted(() => ({
  updateTitle: vi.fn(),
  task: { id: "task-a", projectId: "project-1", title: "Old title" },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/task/use-get-task", () => ({
  default: () => ({ data: mocks.task }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-title", () => ({
  useUpdateTaskTitle: () => ({ mutateAsync: mocks.updateTitle }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateTasks: () => true }),
}));

const pressSave = (target: Element) =>
  fireEvent.keyDown(target, { key: "s", code: "KeyS", ctrlKey: true });

beforeEach(() => {
  vi.useFakeTimers();
  mocks.updateTitle.mockReset();
  mocks.updateTitle.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("TaskTitle Ctrl+S", () => {
  const renderTitle = () => {
    render(
      <ShortcutTestWrapper>
        <TaskTitle taskId="task-a" />
      </ShortcutTestWrapper>,
    );
    return screen.getByPlaceholderText("tasks:detail.titlePlaceholder");
  };

  it("saves a pending title edit at once", () => {
    const title = renderTitle();
    fireEvent.change(title, { target: { value: "New title" } });
    expect(mocks.updateTitle).not.toHaveBeenCalled();

    let notCancelled = true;
    act(() => {
      notCancelled = pressSave(title);
    });

    expect(notCancelled).toBe(false);
    expect(mocks.updateTitle).toHaveBeenCalledTimes(1);
    expect(mocks.updateTitle.mock.calls[0][0]).toMatchObject({
      id: "task-a",
      title: "New title",
    });

    act(() => vi.advanceTimersByTime(1000));
    expect(mocks.updateTitle).toHaveBeenCalledTimes(1);
  });

  it("sends nothing when there is no pending title edit", () => {
    const title = renderTitle();

    act(() => {
      pressSave(title);
    });
    act(() => vi.advanceTimersByTime(1000));

    expect(mocks.updateTitle).not.toHaveBeenCalled();
  });
});

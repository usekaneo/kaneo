import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { shortcutRegistry } from "@/lib/shortcuts/registry";
import { ShortcutTestWrapper } from "@/lib/shortcuts/shortcut-test-wrapper";
import useBulkSelectionStore from "@/store/bulk-selection";
import type { TaskLayout } from "./task-groups";
import { useTaskViewShortcuts } from "./use-task-view-shortcuts";

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
  useRouter: () => ({ preloadRoute: () => Promise.resolve() }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/toast", () => ({ toast: { message: vi.fn(), error: vi.fn() } }));

const groups = [
  { id: "todo", taskIds: ["a", "b", "c"] },
  { id: "doing", taskIds: ["d"] },
];

const callbacks = {
  onMove: vi.fn(),
  onToggleGroup: vi.fn(),
  onToggleAllGroups: vi.fn(),
};

function Harness({
  layout,
  canMove,
}: {
  layout: TaskLayout;
  canMove: boolean;
}) {
  useTaskViewShortcuts({
    layout,
    selection: useBulkSelectionStore,
    getGroups: () => groups,
    project: { id: "project-1", workspaceId: "workspace-1" },
    canMove,
    ...callbacks,
  });
  return (
    <>
      {groups
        .flatMap((group) => group.taskIds)
        .map((id) => (
          <div key={id} data-task-id={id} tabIndex={-1} />
        ))}
    </>
  );
}

function renderView(layout: TaskLayout = "board", canMove = true) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ShortcutTestWrapper>
        <Harness layout={layout} canMove={canMove} />
      </ShortcutTestWrapper>
    </QueryClientProvider>,
  );
}

const press = (init: KeyboardEventInit) =>
  fireEvent.keyDown(document.body, init);
const nextFrame = () =>
  act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
const focused = () => useBulkSelectionStore.getState().focusedTaskId;
const focus = (taskId: string) =>
  act(() => useBulkSelectionStore.getState().setFocusedTask(taskId));

beforeEach(() => {
  window.history.replaceState({}, "", "/board");
});

afterEach(() => {
  cleanup();
  shortcutRegistry.reset();
  useBulkSelectionStore.getState().clearFocus();
  useBulkSelectionStore.getState().clearSelection();
  vi.clearAllMocks();
});

describe("useTaskViewShortcuts", () => {
  it("moves focus through a board and focuses the card", async () => {
    renderView();

    press({ key: "j", code: "KeyJ" });
    expect(focused()).toBe("a");
    press({ key: "ArrowDown", code: "ArrowDown" });
    press({ key: "ArrowRight", code: "ArrowRight" });
    expect(focused()).toBe("d");
    await nextFrame();

    expect(document.activeElement?.getAttribute("data-task-id")).toBe("d");
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("clears the focused task on Escape", async () => {
    renderView();
    press({ key: "j", code: "KeyJ" });
    await nextFrame();
    expect(document.activeElement?.getAttribute("data-task-id")).toBe("a");

    press({ key: "Escape", code: "Escape" });

    expect(focused()).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it("leaves Escape to the selection while tasks are selected", () => {
    renderView();
    focus("a");
    act(() => useBulkSelectionStore.getState().selectTasks(["a"]));

    press({ key: "Escape", code: "Escape" });

    expect(focused()).toBe("a");
  });

  it("keeps the open preview on the focused task", async () => {
    window.history.replaceState({}, "", "/board?taskId=a");
    renderView();
    focus("a");

    press({ key: "j", code: "KeyJ" });
    await nextFrame();

    expect(mocks.navigate).toHaveBeenLastCalledWith({
      to: ".",
      search: { taskId: "b" },
      replace: true,
    });
    expect(document.activeElement).toBe(document.body);
  });

  it("opens and closes the preview with Space", () => {
    renderView();
    focus("b");

    press({ key: " ", code: "Space" });
    expect(mocks.navigate).toHaveBeenLastCalledWith({
      to: ".",
      search: { taskId: "b" },
      replace: false,
    });

    window.history.replaceState({}, "", "/board?taskId=b");
    press({ key: " ", code: "Space" });
    expect(mocks.navigate).toHaveBeenLastCalledWith({
      to: ".",
      search: {},
      replace: true,
    });
  });

  it("moves the focused task within its group and across columns", () => {
    renderView();
    focus("a");

    press({ key: "ArrowDown", code: "ArrowDown", altKey: true });
    press({
      key: "ArrowDown",
      code: "ArrowDown",
      altKey: true,
      shiftKey: true,
    });
    press({ key: "ArrowRight", code: "ArrowRight", altKey: true });
    press({ key: "ArrowUp", code: "ArrowUp", altKey: true });

    expect(callbacks.onMove.mock.calls).toEqual([
      ["a", "b"],
      ["a", "c"],
      ["a", "doing"],
    ]);
  });

  it("leaves moves off when the view cannot reorder", () => {
    renderView("board", false);
    focus("a");

    press({ key: "ArrowDown", code: "ArrowDown", altKey: true });

    expect(callbacks.onMove).not.toHaveBeenCalled();
  });

  it("keeps column moves and column focus to the board", () => {
    renderView("list");
    focus("c");

    press({ key: "ArrowRight", code: "ArrowRight" });
    press({ key: "ArrowRight", code: "ArrowRight", altKey: true });
    press({ key: "j", code: "KeyJ" });

    expect(callbacks.onMove).not.toHaveBeenCalled();
    expect(focused()).toBe("d");
  });

  it("selects the focused task and its whole group", () => {
    renderView();
    focus("d");

    press({ key: "x", code: "KeyX" });
    expect(useBulkSelectionStore.getState().selectedTaskIds).toEqual(
      new Set(["d"]),
    );

    focus("b");
    press({ key: "a", code: "KeyA", ctrlKey: true, altKey: true });
    expect(useBulkSelectionStore.getState().selectedTaskIds).toEqual(
      new Set(["d", "a", "b", "c"]),
    );
  });

  it("collapses the focused group or all groups", () => {
    renderView("list");
    focus("d");

    press({ key: "t", code: "KeyT" });
    press({ key: "†", code: "KeyT", altKey: true });

    expect(callbacks.onToggleGroup).toHaveBeenCalledWith("doing");
    expect(callbacks.onToggleAllGroups).toHaveBeenCalledTimes(1);
  });
});

import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import TaskTitle from "./task-title";

const mocks = vi.hoisted(() => ({
  task: { id: "task-1", projectId: "project-1", title: "Old title" },
  mutateAsync: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/queries/task/use-get-task", () => ({
  default: (id: string) => ({ data: { ...mocks.task, id } }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-title", () => ({
  useUpdateTaskTitle: () => ({ mutateAsync: mocks.mutateAsync }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateTasks: () => true }),
}));
vi.mock("@/lib/toast", () => ({ toast: { error: mocks.toastError } }));

function getTextarea(container: HTMLElement) {
  const textarea = container.querySelector("textarea");
  if (!textarea) throw new Error("title textarea not rendered");
  return textarea;
}

function edit(textarea: HTMLTextAreaElement, value: string) {
  fireEvent.change(textarea, { target: { value } });
  fireEvent.blur(textarea);
}

describe("TaskTitle", () => {
  afterEach(async () => {
    vi.useRealTimers();
    cleanup();
    await new Promise((resolve) => setTimeout(resolve, 0));
    mocks.task.title = "Old title";
    mocks.mutateAsync.mockReset();
    mocks.toastError.mockReset();
  });

  it("does not save while typing, only once on Enter", async () => {
    mocks.mutateAsync.mockResolvedValue({});
    const { container } = render(<TaskTitle taskId="task-1" />);
    const textarea = getTextarea(container);

    textarea.focus();
    fireEvent.change(textarea, { target: { value: "New" } });
    fireEvent.change(textarea, { target: { value: "New title" } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.mutateAsync).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: "Enter" });
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
    expect(mocks.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: "task-1", title: "New title" }),
    );
  });

  it("does not save on blur when the title is unchanged", async () => {
    const { container } = render(<TaskTitle taskId="task-1" />);

    edit(getTextarea(container), "Old title");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("saves an unsaved edit when the task closes", async () => {
    mocks.mutateAsync.mockResolvedValue({});
    const { container, unmount } = render(<TaskTitle taskId="task-1" />);

    fireEvent.change(getTextarea(container), {
      target: { value: "Edited then closed" },
    });
    unmount();
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
    expect(mocks.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Edited then closed" }),
    );
  });

  it("shows an error and retries a failed save on the next blur", async () => {
    mocks.mutateAsync
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({});
    const { container } = render(<TaskTitle taskId="task-1" />);
    const textarea = getTextarea(container);

    edit(textarea, "New title");
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));

    fireEvent.blur(textarea);
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(2));
    expect(mocks.mutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "New title" }),
    );
  });

  it("does not retry an old task's failed save on the next task", async () => {
    let fail: (error: Error) => void = () => {};
    mocks.mutateAsync
      .mockReturnValueOnce(
        new Promise<void>((_resolve, reject) => {
          fail = reject;
        }),
      )
      .mockResolvedValue({});
    const { container, rerender } = render(<TaskTitle taskId="old-task" />);

    edit(getTextarea(container), "Title for the old task");
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
    rerender(<TaskTitle taskId="next-task" />);
    fail(new Error("offline"));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));

    fireEvent.blur(getTextarea(container));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("preserves a newer draft when a previous save refetches", async () => {
    vi.useFakeTimers();
    mocks.mutateAsync.mockResolvedValue({});
    const { container, rerender } = render(<TaskTitle taskId="task-1" />);
    const textarea = getTextarea(container);

    edit(textarea, "First save");
    fireEvent.change(textarea, { target: { value: "Still editing" } });
    await act(() => vi.runOnlyPendingTimersAsync());
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1);
    mocks.task.title = "First save";
    rerender(<TaskTitle taskId="task-1" />);

    expect(textarea).toHaveValue("Still editing");
    fireEvent.blur(textarea);
    await act(() => vi.runOnlyPendingTimersAsync());
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(2);
    expect(mocks.mutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Still editing" }),
    );
  });

  it("saves a revert after the first save succeeds but before refetch", async () => {
    vi.useFakeTimers();
    let finishFirst = () => {};
    mocks.mutateAsync
      .mockReturnValueOnce(
        new Promise<void>((resolve) => {
          finishFirst = resolve;
        }),
      )
      .mockResolvedValue({});
    const { container } = render(<TaskTitle taskId="task-1" />);
    const textarea = getTextarea(container);

    edit(textarea, "New title");
    await act(() => vi.runOnlyPendingTimersAsync());
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1);
    fireEvent.change(textarea, { target: { value: "Old title" } });
    await act(async () => finishFirst());
    fireEvent.blur(textarea);
    await act(() => vi.runOnlyPendingTimersAsync());
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(2);
    expect(mocks.mutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Old title" }),
    );
  });

  it("saves a quick revert after the first save finishes", async () => {
    let finishFirst = () => {};
    mocks.mutateAsync
      .mockReturnValueOnce(
        new Promise<void>((resolve) => {
          finishFirst = resolve;
        }),
      )
      .mockResolvedValue({});
    const { container } = render(<TaskTitle taskId="task-1" />);
    const textarea = getTextarea(container);

    edit(textarea, "New title");
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1));
    edit(textarea, "Old title");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1);

    finishFirst();
    await waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(2));
    expect(mocks.mutateAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Old title" }),
    );
  });
});

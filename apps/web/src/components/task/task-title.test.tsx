import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import TaskTitle from "./task-title";

const mocks = vi.hoisted(() => ({
  task: { id: "task-1", projectId: "project-1", title: "Old title" },
  mutateAsync: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/queries/task/use-get-task", () => ({
  default: () => ({ data: mocks.task }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-title", () => ({
  useUpdateTaskTitle: () => ({ mutateAsync: mocks.mutateAsync }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateTasks: () => true }),
}));

function getTextarea(container: HTMLElement) {
  const textarea = container.querySelector("textarea");
  if (!textarea) throw new Error("title textarea not rendered");
  return textarea;
}

describe("TaskTitle", () => {
  afterEach(() => {
    cleanup();
    mocks.mutateAsync.mockReset();
  });

  it("does not save while typing, only once on Enter", () => {
    const { container } = render(<TaskTitle taskId="task-1" />);
    const textarea = getTextarea(container);

    textarea.focus();
    fireEvent.change(textarea, { target: { value: "New" } });
    fireEvent.change(textarea, { target: { value: "New title" } });
    expect(mocks.mutateAsync).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1);
    expect(mocks.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: "task-1", title: "New title" }),
    );
  });

  it("does not save on blur when the title is unchanged", () => {
    const { container } = render(<TaskTitle taskId="task-1" />);
    const textarea = getTextarea(container);

    fireEvent.change(textarea, { target: { value: "Old title" } });
    fireEvent.blur(textarea);
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("saves an unsaved edit when the task closes", () => {
    const { container, unmount } = render(<TaskTitle taskId="task-1" />);

    fireEvent.change(getTextarea(container), {
      target: { value: "Edited then closed" },
    });
    unmount();
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1);
    expect(mocks.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Edited then closed" }),
    );
  });
});

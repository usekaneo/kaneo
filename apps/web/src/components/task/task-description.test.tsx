import { fireEvent, render, waitFor } from "@testing-library/react";
import { Extension } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import { describe, expect, it, vi } from "vitest";
import TaskDescription from "./task-description";

const mocks = vi.hoisted(() => ({
  t: (key: string) => key,
  tasks: new Map<string, { id: string; description: string }>(),
}));

// Only the extensions that pull in browser-only machinery are replaced, and
// they are replaced with real (inert) Tiptap extensions rather than plain
// objects, so `useEditor` builds a genuine editor. The editor lifecycle is the
// thing under test here; stubbing it out is what let the previous version of
// this file pass while #1580 was still broken.
function inert(name: string) {
  return Extension.create({ name });
}

vi.mock("./extensions/shiki-code-block", () => ({
  ShikiCodeBlock: inert("shikiCodeBlockStub"),
}));
vi.mock("./extensions/mermaid-block", () => ({
  MermaidBlock: inert("mermaidBlockStub"),
}));
vi.mock("./extensions/embed-block", () => ({
  EmbedBlock: inert("embedBlockStub"),
}));
vi.mock("./extensions/attachment-card", () => ({
  AttachmentCard: inert("attachmentCardStub"),
}));
vi.mock("./extensions/kaneo-issue-link", () => ({
  KaneoIssueLink: inert("kaneoIssueLinkStub"),
}));
vi.mock("./extensions/task-item-with-checkbox", () => ({
  TaskItemWithCheckbox: TaskItem,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mocks.t }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/queries/task/use-get-task", () => ({
  default: (taskId: string) => ({ data: mocks.tasks.get(taskId) }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-description", () => ({
  useUpdateTaskDescription: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateTasks: () => true }),
}));
vi.mock("@/lib/toast", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock("@/lib/upload-task-image", () => ({ uploadTaskImage: vi.fn() }));
vi.mock("@/lib/shiki-highlighter", () => ({
  getSharedShikiHighlighter: () => new Promise(() => {}),
}));

describe("TaskDescription", () => {
  it("renders the parent description when navigating from a subtask (#1580)", async () => {
    mocks.tasks.set("child-task", {
      id: "child-task",
      description: "child body",
    });
    mocks.tasks.set("parent-task", {
      id: "parent-task",
      description: "parent body",
    });

    const { container, rerender } = render(
      <TaskDescription taskId="child-task" />,
    );

    await waitFor(() => {
      expect(container.textContent).toContain("child body");
    });

    // The "Subtask of X" backlink: the same component instance is handed a
    // different task id. Before #1580 was fixed this destroyed the editor and
    // the hydration effect then read `commands` off the destroyed instance.
    rerender(<TaskDescription taskId="parent-task" />);

    await waitFor(() => {
      expect(container.textContent).toContain("parent body");
    });
    expect(container.textContent).not.toContain("child body");
  });

  it("does not let undo pull the previous task's description back (#1580)", async () => {
    mocks.tasks.set("child-task", {
      id: "child-task",
      description: "child body",
    });
    mocks.tasks.set("parent-task", {
      id: "parent-task",
      description: "parent body",
    });

    const { container, rerender } = render(
      <TaskDescription taskId="child-task" />,
    );
    await waitFor(() => {
      expect(container.textContent).toContain("child body");
    });

    rerender(<TaskDescription taskId="parent-task" />);
    await waitFor(() => {
      expect(container.textContent).toContain("parent body");
    });

    // The editor now survives the task switch, so its undo stack would still
    // hold the previous task's document unless hydration is kept out of the
    // history. Undoing into it would also schedule a save of the child's
    // markdown against the parent's id.
    const editable = container.querySelector<HTMLElement>(
      '[contenteditable="true"]',
    );
    expect(editable).not.toBeNull();
    fireEvent.keyDown(editable as HTMLElement, {
      key: "z",
      code: "KeyZ",
      ctrlKey: true,
    });

    expect(container.textContent).toContain("parent body");
    expect(container.textContent).not.toContain("child body");
  });
});

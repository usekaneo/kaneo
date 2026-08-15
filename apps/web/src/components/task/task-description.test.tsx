import { fireEvent, render, waitFor } from "@testing-library/react";
import { Extension } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import { describe, expect, it, vi } from "vitest";
import { toast } from "@/lib/toast";
import { uploadTaskImage } from "@/lib/upload-task-image";
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

  it("does not insert an upload that completes after navigating to another task", async () => {
    mocks.tasks.set("task-a", {
      id: "task-a",
      description: "task a body",
    });
    mocks.tasks.set("task-b", {
      id: "task-b",
      description: "task b body",
    });

    const { container, rerender } = render(
      <TaskDescription taskId="task-a" />,
    );
    await waitFor(() => {
      expect(container.textContent).toContain("task a body");
    });

    let resolveUpload!: (asset: unknown) => void;
    const pendingUpload = new Promise((resolve) => {
      resolveUpload = resolve;
    });
    const uploadMock = vi.mocked(uploadTaskImage);
    uploadMock.mockReturnValueOnce(
      pendingUpload as ReturnType<typeof uploadTaskImage>,
    );

    const fileInput = container.querySelector<HTMLInputElement>(
      'input[type="file"]',
    );
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput as HTMLInputElement, {
      target: {
        files: [new File(["x"], "stale.png", { type: "image/png" })],
      },
    });

    await waitFor(() => {
      expect(uploadMock).toHaveBeenCalledWith({
        taskId: "task-a",
        surface: "description",
        file: expect.any(File),
      });
    });

    rerender(<TaskDescription taskId="task-b" />);
    await waitFor(() => {
      expect(container.textContent).toContain("task b body");
    });

    resolveUpload({
      kind: "image",
      url: "https://example.com/stale.png",
      alt: "stale",
    });
    await waitFor(() => {
      expect(uploadMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      const inserted = container.querySelector('img[src*="stale.png"]');
      expect(inserted).toBeNull();
    });
    expect(container.querySelector('[contenteditable="true"]')?.textContent).toBe(
      "task b body",
    );
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
      "tasks:detail.editor.upload.taskChanged",
    );
  });
});

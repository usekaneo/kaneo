import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { Extension } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import { EditorView } from "@tiptap/pm/view";
import type { Editor } from "@tiptap/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { toast } from "@/lib/toast";
import { uploadTaskImage } from "@/lib/upload-task-image";
import TaskDescription from "./task-description";

const mocks = vi.hoisted(() => ({
  t: (key: string) => key,
  tasks: new Map<
    string,
    { id: string; projectId: string; description: string }
  >(),
  mutateAsync: vi.fn(),
  editors: [] as unknown[],
}));

vi.mock("@tiptap/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tiptap/react")>();
  return {
    ...actual,
    useEditor: (...args: Parameters<typeof actual.useEditor>) => {
      const editor = actual.useEditor(...args);
      if (editor && !mocks.editors.includes(editor)) mocks.editors.push(editor);
      return editor;
    },
  };
});

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
  useUpdateTaskDescription: () => ({ mutateAsync: mocks.mutateAsync }),
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

const DEBOUNCE_MS = 700;
const uploadMock = vi.mocked(uploadTaskImage);
const asset = {
  url: "/api/asset/asset-1",
  alt: "paste",
  filename: "paste.png",
  kind: "image" as const,
  mimeType: "image/png",
  size: 18,
};

function latestEditor() {
  return mocks.editors[mocks.editors.length - 1] as Editor;
}

// Hydration parks the editor behind a flag cleared on a later animation
// frame. An edit dispatched before that is swallowed, not saved. Waiting on a
// frame rather than a delay is what makes it deterministic: hydration's
// callback is already queued, so one queued after it cannot run first.
async function settle() {
  await act(async () => {
    await new Promise((resolve) => {
      requestAnimationFrame(() => resolve(undefined));
    });
  });
}

function savedTaskIds() {
  return mocks.mutateAsync.mock.calls.map((call) => call[0].id);
}

function pasteFile(editor: Editor) {
  fireEvent.paste(editor.view.dom, {
    clipboardData: {
      files: [new File(["image"], "paste.png", { type: "image/png" })],
      getData: () => "",
    },
  });
}

function deferredUpload() {
  let resolveUpload!: (value: typeof asset) => void;
  uploadMock.mockImplementation(
    () =>
      new Promise<typeof asset>((resolve) => {
        resolveUpload = resolve;
      }),
  );
  return () => resolveUpload(asset);
}

beforeAll(() => {
  vi.spyOn(EditorView.prototype, "coordsAtPos").mockReturnValue({
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  });
});

beforeEach(() => {
  mocks.mutateAsync.mockReset();
  mocks.mutateAsync.mockResolvedValue({});
  mocks.editors.length = 0;
  mocks.t = (key: string) => key;
  uploadMock.mockReset();
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.dismiss).mockClear();
  mocks.tasks.set("task-a", {
    id: "task-a",
    projectId: "project-1",
    description: "alpha",
  });
  mocks.tasks.set("task-b", {
    id: "task-b",
    projectId: "project-1",
    description: "bravo",
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TaskDescription pending saves", () => {
  it("inserts an uploaded image into a replacement editor and saves it", async () => {
    const resolveUpload = deferredUpload();
    const { container, rerender } = render(<TaskDescription taskId="task-a" />);
    await waitFor(() => expect(container.textContent).toContain("alpha"));
    await settle();

    const firstEditor = latestEditor();
    pasteFile(firstEditor);
    await act(async () => {});
    expect(uploadMock).toHaveBeenCalledTimes(1);

    mocks.t = (key: string) => key;
    rerender(<TaskDescription taskId="task-a" />);
    const currentEditor = latestEditor();
    expect(currentEditor).not.toBe(firstEditor);
    expect(firstEditor.isDestroyed).toBe(true);
    await settle();

    await act(async () => resolveUpload());

    expect(currentEditor.getHTML()).toContain(asset.url);
    await vi.waitFor(
      () =>
        expect(
          mocks.mutateAsync.mock.calls.some(([saved]) =>
            saved.description.includes(asset.url),
          ),
        ).toBe(true),
      { timeout: DEBOUNCE_MS * 4 },
    );
  });

  it("reports an error when no live editor remains on the active task", async () => {
    const resolveUpload = deferredUpload();
    const { container } = render(<TaskDescription taskId="task-a" />);
    await waitFor(() => expect(container.textContent).toContain("alpha"));
    await settle();

    const editor = latestEditor();
    pasteFile(editor);
    await waitFor(() => expect(uploadMock).toHaveBeenCalledOnce());
    act(() => editor.destroy());
    await act(async () => resolveUpload());

    expect(toast.error).toHaveBeenCalledWith(
      "tasks:detail.editor.upload.failed",
    );
    expect(toast.dismiss).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("quietly cancels an upload after the description unmounts", async () => {
    const resolveUpload = deferredUpload();
    const { container, unmount } = render(<TaskDescription taskId="task-a" />);
    await waitFor(() => expect(container.textContent).toContain("alpha"));
    await settle();
    pasteFile(latestEditor());
    await waitFor(() => expect(uploadMock).toHaveBeenCalledOnce());

    unmount();
    await act(async () => resolveUpload());

    expect(toast.dismiss).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("quietly cancels an upload after navigating to another task", async () => {
    const resolveUpload = deferredUpload();
    const { container, rerender } = render(<TaskDescription taskId="task-a" />);
    await waitFor(() => expect(container.textContent).toContain("alpha"));
    await settle();
    pasteFile(latestEditor());
    await waitFor(() => expect(uploadMock).toHaveBeenCalledOnce());

    rerender(<TaskDescription taskId="task-b" />);
    await waitFor(() => expect(container.textContent).toContain("bravo"));
    await settle();
    await act(async () => resolveUpload());

    expect(latestEditor().getHTML()).not.toContain(asset.url);
    expect(toast.dismiss).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("saves an edit to the task it was typed in, not the one navigated to", async () => {
    const { container, rerender } = render(<TaskDescription taskId="task-a" />);
    await waitFor(() => expect(container.textContent).toContain("alpha"));

    await settle();
    latestEditor().commands.insertContent(" edited in a");
    expect(mocks.mutateAsync).not.toHaveBeenCalled();

    rerender(<TaskDescription taskId="task-b" />);
    await waitFor(() => expect(container.textContent).toContain("bravo"));

    await vi.waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(1), {
      timeout: DEBOUNCE_MS * 4,
    });

    const [saved] = mocks.mutateAsync.mock.calls[0];
    expect(saved.id).toBe("task-a");
    expect(saved.description).toContain("edited in a");
  });

  it("does not let an edit in one task cancel another task's pending save", async () => {
    const { container, rerender } = render(<TaskDescription taskId="task-a" />);
    await waitFor(() => expect(container.textContent).toContain("alpha"));

    await settle();
    latestEditor().commands.insertContent(" edited in a");

    rerender(<TaskDescription taskId="task-b" />);
    await waitFor(() => expect(container.textContent).toContain("bravo"));

    await settle();
    latestEditor().commands.insertContent(" edited in b");

    await vi.waitFor(() => expect(mocks.mutateAsync).toHaveBeenCalledTimes(2), {
      timeout: DEBOUNCE_MS * 4,
    });

    expect(savedTaskIds().sort()).toEqual(["task-a", "task-b"]);
  });
});

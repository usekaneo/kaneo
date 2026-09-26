import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { Extension } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import { EditorView } from "@tiptap/pm/view";
import type { Editor } from "@tiptap/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "@/lib/toast";
import { uploadTaskImage } from "@/lib/upload-task-image";
import CommentEditor from "./comment-editor";

const mocks = vi.hoisted(() => ({
  t: (key: string) => key,
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

vi.mock("@/components/task/extensions/shiki-code-block", () => ({
  ShikiCodeBlock: inert("shikiCodeBlockStub"),
}));
vi.mock("@/components/task/extensions/mermaid-block", () => ({
  MermaidBlock: inert("mermaidBlockStub"),
}));
vi.mock("@/components/task/extensions/embed-block", () => ({
  EmbedBlock: inert("embedBlockStub"),
}));
vi.mock("@/components/task/extensions/attachment-card", () => ({
  AttachmentCard: inert("attachmentCardStub"),
}));
vi.mock("@/components/task/extensions/kaneo-issue-link", () => ({
  KaneoIssueLink: inert("kaneoIssueLinkStub"),
}));
vi.mock("@/components/task/extensions/kaneo-mention", () => ({
  KaneoMention: inert("kaneoMentionStub"),
}));
vi.mock("@/components/task/extensions/mention-suggestion", () => ({
  MentionSuggestion: inert("mentionSuggestionStub"),
}));
vi.mock("@/components/task/extensions/task-item-with-checkbox", () => ({
  TaskItemWithCheckbox: TaskItem,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mocks.t }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: undefined }),
}));
vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({ data: undefined }),
  }),
);
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

const uploadMock = vi.mocked(uploadTaskImage);
const toastError = vi.mocked(toast.error);

const asset = {
  url: "/api/asset/asset-9",
  alt: "paste",
  filename: "paste.png",
  kind: "image" as const,
  mimeType: "image/png",
  size: 18,
};

function latestEditor() {
  return mocks.editors[mocks.editors.length - 1] as Editor;
}

function pasteFile(editor: Editor) {
  const file = new File(["fake-image-bytes"], "paste.png", {
    type: "image/png",
  });
  fireEvent.paste(editor.view.dom, {
    clipboardData: { files: [file], getData: () => "" },
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

// jsdom has no layout, so ProseMirror cannot compute coordinates when a
// command scrolls the selection into view. Browsers are unaffected.
beforeAll(() => {
  vi.spyOn(EditorView.prototype, "coordsAtPos").mockReturnValue({
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  });
});

beforeEach(() => {
  mocks.editors.length = 0;
  vi.mocked(toast.error).mockClear();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.dismiss).mockClear();
  uploadMock.mockReset();
});

describe("CommentEditor image upload insertion", () => {
  it("inserts into the current editor when it is recreated mid-upload", async () => {
    const resolveUpload = deferredUpload();
    const onChange = vi.fn();

    const editorProps = {
      value: "",
      onChange,
      taskId: "task-1",
      placeholder: "first",
    };
    const { rerender } = render(<CommentEditor {...editorProps} />);
    await waitFor(() => expect(latestEditor()).toBeDefined());

    const firstEditor = latestEditor();
    pasteFile(firstEditor);
    await act(async () => {});
    expect(uploadMock).toHaveBeenCalledTimes(1);

    // Simulate the editor being recreated while the upload is in flight: a
    // changed placeholder flows into the useEditor dependencies.
    rerender(<CommentEditor {...editorProps} placeholder="second" />);
    const currentEditor = latestEditor();
    expect(currentEditor).not.toBe(firstEditor);
    expect(firstEditor.isDestroyed).toBe(true);

    await act(async () => {
      resolveUpload();
    });

    expect(currentEditor.getHTML()).toContain("/api/asset/asset-9");
    expect(onChange).toHaveBeenCalledWith(
      expect.stringContaining("/api/asset/asset-9"),
    );
  });

  it("does not insert into a replacement editor for another task", async () => {
    const resolveUpload = deferredUpload();
    const props = {
      value: "",
      onChange: () => {},
      taskId: "task-1",
      placeholder: "first",
    };
    const { rerender } = render(<CommentEditor {...props} />);
    await waitFor(() => expect(latestEditor()).toBeDefined());

    const firstEditor = latestEditor();
    pasteFile(firstEditor);
    await act(async () => {});

    rerender(<CommentEditor {...props} taskId="task-2" placeholder="second" />);
    const currentEditor = latestEditor();
    expect(currentEditor).not.toBe(firstEditor);

    await act(async () => resolveUpload());

    expect(currentEditor.getHTML()).not.toContain("/api/asset/asset-9");
    expect(toastError).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("does not insert an ensured draft upload into another task", async () => {
    const resolveUpload = deferredUpload();
    const props = {
      value: "",
      onChange: () => {},
      ensureTaskId: () => Promise.resolve("task-1"),
      placeholder: "first",
    };
    const { rerender } = render(<CommentEditor {...props} />);
    await waitFor(() => expect(latestEditor()).toBeDefined());

    const firstEditor = latestEditor();
    pasteFile(firstEditor);
    await waitFor(() => expect(uploadMock).toHaveBeenCalled());

    rerender(<CommentEditor {...props} taskId="task-2" placeholder="second" />);
    const currentEditor = latestEditor();
    expect(currentEditor).not.toBe(firstEditor);

    await act(async () => resolveUpload());

    expect(currentEditor.getHTML()).not.toContain("/api/asset/asset-9");
    expect(toastError).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("reports an error when no live editor remains on the active task", async () => {
    const resolveUpload = deferredUpload();
    render(<CommentEditor value="" onChange={() => {}} taskId="task-1" />);
    await waitFor(() => expect(latestEditor()).toBeDefined());

    const editor = latestEditor();
    pasteFile(editor);
    await waitFor(() => expect(uploadMock).toHaveBeenCalledOnce());
    // The upload finishes before a replacement editor is available.
    act(() => editor.destroy());
    await act(async () => resolveUpload());

    expect(toastError).toHaveBeenCalledWith(
      "activity:comment.editor.failedToUploadFile",
    );
    expect(toast.dismiss).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("quietly cancels an upload after the editor surface unmounts", async () => {
    const resolveUpload = deferredUpload();
    const onChange = vi.fn();
    const { unmount } = render(
      <CommentEditor value="" onChange={onChange} taskId="task-1" />,
    );
    await waitFor(() => expect(latestEditor()).toBeDefined());
    pasteFile(latestEditor());
    await waitFor(() => expect(uploadMock).toHaveBeenCalledOnce());
    onChange.mockClear();

    unmount();
    await act(async () => resolveUpload());

    expect(toast.dismiss).toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports an error when the insert command does not execute", async () => {
    const resolveUpload = deferredUpload();
    render(<CommentEditor value="" onChange={() => {}} taskId="task-1" />);
    await waitFor(() => expect(latestEditor()).toBeDefined());

    const editor = latestEditor();
    const chain = editor.chain();
    vi.spyOn(chain, "run").mockReturnValue(false);
    vi.spyOn(editor, "chain").mockReturnValue(chain);

    pasteFile(editor);
    await act(async () => {});
    await act(async () => resolveUpload());

    expect(toastError).toHaveBeenCalledWith(
      "activity:comment.editor.failedToUploadFile",
    );
  });
});

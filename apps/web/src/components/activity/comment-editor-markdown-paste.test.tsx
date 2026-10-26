import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { Extension } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import type { Editor } from "@tiptap/react";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
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
vi.mock("@/hooks/queries/workspace-users/use-get-project-members", () => ({
  default: () => ({ data: undefined }),
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

function latestEditor() {
  return mocks.editors[mocks.editors.length - 1] as Editor;
}

function pasteText(editor: Editor, text: string) {
  fireEvent.paste(editor.view.dom, {
    clipboardData: {
      files: [],
      getData: (type: string) => (type === "text/plain" ? text : ""),
    },
  });
}

beforeEach(() => {
  mocks.editors.length = 0;
});

describe("CommentEditor Markdown paste", () => {
  it.each([
    "Status\n---\n22/tcp ALLOW Anywhere",
    "Status\n\n    22/tcp ALLOW Anywhere",
  ])("inserts %s into the replacement editor", async (text) => {
    const onChange = vi.fn();
    const props = { value: "", onChange, placeholder: "first" };
    const { rerender } = render(<CommentEditor {...props} />);
    await waitFor(() => expect(latestEditor()).toBeDefined());
    const firstEditor = latestEditor();

    rerender(<CommentEditor {...props} placeholder="second" />);
    const currentEditor = latestEditor();
    expect(currentEditor).not.toBe(firstEditor);
    expect(firstEditor.isDestroyed).toBe(true);
    await act(async () => {});

    pasteText(currentEditor, text);

    expect(currentEditor.getText()).toContain("22/tcp ALLOW Anywhere");
    expect(currentEditor.getHTML()).toContain(
      text.includes("---") ? "<h2>Status</h2>" : "<pre",
    );
    expect(onChange).toHaveBeenCalledWith(
      expect.stringContaining("22/tcp ALLOW Anywhere"),
    );
  });

  it("keeps Markdown-like text literal in the replacement editor's code block", async () => {
    const onChange = vi.fn();
    const props = { value: "", onChange, placeholder: "first" };
    const { rerender } = render(<CommentEditor {...props} />);
    await waitFor(() => expect(latestEditor()).toBeDefined());
    const firstEditor = latestEditor();

    rerender(<CommentEditor {...props} placeholder="second" />);
    const currentEditor = latestEditor();
    expect(firstEditor.isDestroyed).toBe(true);
    await act(async () => {});
    act(() => {
      currentEditor.commands.setCodeBlock();
    });
    onChange.mockClear();
    const text = "Status\n---\n    22/tcp ALLOW Anywhere";

    pasteText(currentEditor, text);

    expect(currentEditor.getText()).toBe(text);
    expect(currentEditor.getHTML()).not.toContain("<h2>");
    expect(currentEditor.getHTML()).toContain("<pre");
    expect(onChange).toHaveBeenCalledWith(expect.stringContaining(text));
  });
});

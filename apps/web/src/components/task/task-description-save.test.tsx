import { act, render, waitFor } from "@testing-library/react";
import { Extension } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import type { Editor } from "@tiptap/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

beforeEach(() => {
  mocks.mutateAsync.mockReset();
  mocks.mutateAsync.mockResolvedValue({});
  mocks.editors.length = 0;
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

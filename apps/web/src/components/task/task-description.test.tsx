import { fireEvent, render, waitFor } from "@testing-library/react";
import { type Editor, Extension } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import { describe, expect, it, vi } from "vite-plus/test";
import TaskDescription from "./task-description";

const mocks = vi.hoisted(() => ({
  t: (key: string) => key,
  save: vi.fn(),
  editor: null as Editor | null,
  tasks: new Map<string, { id: string; description: string }>(),
}));

// Only the extensions that pull in browser-only machinery are replaced, and
// they are replaced with real (inert) Tiptap extensions rather than plain
// objects, so `useEditor` builds a genuine editor. The editor lifecycle is the
// thing under test here; stubbing it out is what let the previous version of
// this file pass while #1580 was still broken.
function inert(name: string) {
  return Extension.create({
    name,
    onCreate() {
      mocks.editor = this.editor;
    },
  });
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
  useUpdateTaskDescription: () => ({ mutateAsync: mocks.save }),
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
  it("pastes Markdown after a language change recreates the editor (#2037)", async () => {
    const taskId = "markdown-recreated-task";
    mocks.editor = null;
    mocks.save.mockClear();
    mocks.tasks.set(taskId, { id: taskId, description: "" });
    const { rerender } = render(<TaskDescription taskId={taskId} />);
    await waitFor(() => expect(mocks.editor?.isDestroyed).toBe(false));
    const firstEditor = mocks.editor!;
    const originalT = mocks.t;

    try {
      mocks.t = (key: string) => key;
      rerender(<TaskDescription taskId={taskId} />);
      await waitFor(() => {
        expect(mocks.editor).not.toBe(firstEditor);
        expect(mocks.editor?.isDestroyed).toBe(false);
      });
      expect(firstEditor.isDestroyed).toBe(true);

      fireEvent.paste(mocks.editor!.view.dom, {
        clipboardData: {
          files: [],
          getData: (type: string) =>
            type === "text/plain" ? "Status\n---\n22/tcp ALLOW Anywhere" : "",
        },
      });

      expect(mocks.editor!.getHTML()).toContain("<h2>Status</h2>");
      expect(mocks.editor!.getText()).toContain("22/tcp ALLOW Anywhere");
      await waitFor(() => expect(mocks.save).toHaveBeenCalled());
      expect(mocks.save.mock.calls.at(-1)![0].description).toContain(
        "22/tcp ALLOW Anywhere",
      );
    } finally {
      mocks.t = originalT;
    }
  });

  it("preserves bold Markdown when pasting, saving and reopening a checklist (#1779)", async () => {
    mocks.save.mockClear();
    mocks.tasks.set("markdown-task", { id: "markdown-task", description: "" });
    const { container, unmount } = render(
      <TaskDescription taskId="markdown-task" />,
    );
    await waitFor(() =>
      expect(
        container.querySelector('[contenteditable="true"]'),
      ).not.toBeNull(),
    );
    await new Promise(requestAnimationFrame);
    const editable = container.querySelector<HTMLElement>(
      '[contenteditable="true"]',
    );
    if (!editable) throw new Error("Editor missing");
    fireEvent.paste(editable, {
      clipboardData: {
        files: [],
        getData: (type: string) =>
          type === "text/plain"
            ? "- [ ] **Provide a staff-only interface.**"
            : "",
      },
    });
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    const saved = mocks.save.mock.calls[0][0].description;
    expect(saved).toContain("**Provide a staff-only interface.**");
    expect(saved).not.toContain("\\*");
    expect(container.querySelector("strong")?.textContent).toBe(
      "Provide a staff-only interface.",
    );
    unmount();
    mocks.tasks.set("markdown-task", {
      id: "markdown-task",
      description: saved,
    });
    const reopened = render(<TaskDescription taskId="markdown-task" />);
    await waitFor(() =>
      expect(reopened.container.querySelector("strong")?.textContent).toBe(
        "Provide a staff-only interface.",
      ),
    );
    reopened.unmount();
  });

  it("preserves blank paragraphs when editing, saving and reopening (#2017)", async () => {
    const taskId = "blank-paragraphs-task";
    let description = "First\n\n\n\nSecond\n\n\n\n\n\nThird\n\n\n\n";

    for (let cycle = 0; cycle < 4; cycle++) {
      mocks.save.mockClear();
      mocks.save.mockResolvedValue(undefined);
      mocks.tasks.set(taskId, { id: taskId, description });
      const { container, unmount } = render(
        <TaskDescription taskId={taskId} />,
      );
      await waitFor(() =>
        expect(
          container.querySelector('[contenteditable="true"]'),
        ).not.toBeNull(),
      );
      await new Promise(requestAnimationFrame);
      const editable = container.querySelector<HTMLElement>(
        '[contenteditable="true"]',
      )!;
      const paragraphs = Array.from(editable.querySelectorAll("p"));
      expect(
        paragraphs.map((paragraph) =>
          paragraph.textContent?.replace(/\u00a0/g, ""),
        ),
      ).toEqual([
        `${"!".repeat(cycle)}First`,
        "",
        "Second",
        "",
        "",
        "Third",
        "",
        "",
      ]);

      if (cycle === 3) {
        unmount();
        break;
      }

      // Make a real editor change so both hydration and saving are exercised.
      mocks.editor!.commands.insertContent("!");
      await waitFor(() => expect(mocks.save).toHaveBeenCalled());
      const saved = mocks.save.mock.calls.at(-1)![0].description as string;
      unmount();
      description = saved;
    }
  });

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

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TaskDescription from "./task-description";

const mocks = vi.hoisted(() => ({
  useEditor: vi.fn(),
  t: (key: string) => key,
}));

vi.mock("@tiptap/react", () => ({
  useEditor: mocks.useEditor,
  EditorContent: () => null,
  NodeViewWrapper: ({ children }: { children: unknown }) => children,
  ReactNodeViewRenderer: () => () => null,
}));
vi.mock("@tiptap/react/menus", () => ({ BubbleMenu: () => null }));
vi.mock("./extensions/attachment-card", () => ({
  AttachmentCard: { configure: () => ({}) },
}));
vi.mock("./extensions/embed-block", () => ({
  EmbedBlock: { configure: () => ({}) },
}));
vi.mock("./extensions/kaneo-issue-link", () => ({
  KaneoIssueLink: { configure: () => ({}) },
}));
vi.mock("./extensions/mermaid-block", () => ({
  MermaidBlock: { configure: () => ({}) },
}));
vi.mock("./extensions/shiki-code-block", () => ({
  ShikiCodeBlock: { configure: () => ({}) },
}));
vi.mock("./extensions/task-item-with-checkbox", () => ({
  TaskItemWithCheckbox: { configure: () => ({}) },
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mocks.t }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/queries/task/use-get-task", () => ({
  default: () => ({ data: undefined }),
}));
vi.mock("@/hooks/mutations/task/use-update-task-description", () => ({
  useUpdateTaskDescription: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canManageTasks: () => true }),
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
  getSharedShikiHighlighter: () => Promise.resolve({}),
}));

describe("TaskDescription", () => {
  it("keeps the useEditor deps stable when the task id changes", () => {
    const depsPerRender: unknown[][] = [];
    mocks.useEditor.mockImplementation((_options: unknown, deps: unknown[]) => {
      depsPerRender.push(deps);
      return null;
    });

    const { rerender } = render(<TaskDescription taskId="task-a" />);
    rerender(<TaskDescription taskId="task-b" />);
    rerender(<TaskDescription taskId="task-c" />);

    expect(depsPerRender.length).toBeGreaterThanOrEqual(3);

    const [first, ...rest] = depsPerRender;
    for (const deps of rest) {
      expect(deps).toHaveLength(first.length);
      deps.forEach((dep, index) => {
        expect(dep).toBe(first[index]);
      });
    }
  });
});

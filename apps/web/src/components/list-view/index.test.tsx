import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectWithTasks } from "@/types/project";
import ListView from ".";

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/mutations/task/use-update-task", () => ({
  useUpdateTask: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/hooks/use-keyboard-shortcuts", () => ({
  useRegisterShortcuts: vi.fn(),
}));
vi.mock("@/hooks/queries/task-relation/use-get-project-task-relations", () => ({
  default: () => ({
    isLoading: false,
    data: [
      {
        sourceTaskId: "parent",
        targetTaskId: "child",
        relationType: "subtask",
      },
      {
        sourceTaskId: "child",
        targetTaskId: "grandchild",
        relationType: "subtask",
      },
    ],
  }),
}));
vi.mock("../bulk-selection/bulk-toolbar", () => ({ default: () => null }));
vi.mock("../shared/modals/create-task-modal", () => ({ default: () => null }));
vi.mock("../shared/modals/archive-tasks-modal", () => ({
  ArchiveTasksModal: () => null,
}));
vi.mock("./task-row", () => ({
  default: ({
    rowId,
    childCount,
    isExpanded,
    onToggleExpanded,
  }: {
    rowId: string;
    childCount: number;
    isExpanded: boolean;
    onToggleExpanded: () => void;
  }) => (
    <div>
      {rowId}
      {childCount > 0 && (
        <button
          type="button"
          aria-label={`Toggle ${rowId}`}
          aria-expanded={isExpanded}
          onClick={onToggleExpanded}
        >
          Toggle
        </button>
      )}
    </div>
  ),
}));

const project = {
  id: "project-focus",
  slug: "FOC",
  workspaceId: "workspace-1",
  columns: [
    {
      id: "to-do",
      name: "To Do",
      isFinal: false,
      icon: null,
      tasks: ["parent", "child", "grandchild"].map((id) => ({
        id,
        title: id,
        status: "to-do",
      })),
    },
  ],
} as ProjectWithTasks;

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("ListView focus", () => {
  it("retains the focused toggle when expanding and collapsing parent and nested rows", () => {
    render(<ListView project={project} />);

    for (const rowId of ["parent", "parent/child"]) {
      const toggle = screen.getByRole("button", { name: `Toggle ${rowId}` });
      toggle.focus();
      fireEvent.click(toggle);

      expect(toggle).toHaveFocus();
      expect(toggle).toHaveAttribute("aria-expanded", "true");
    }

    for (const rowId of ["parent/child", "parent"]) {
      const toggle = screen.getByRole("button", { name: `Toggle ${rowId}` });
      toggle.focus();
      fireEvent.click(toggle);

      expect(toggle).toHaveFocus();
      expect(toggle).toHaveAttribute("aria-expanded", "false");
    }
  });

  it("retains header focus when collapsing and expanding a status group", () => {
    render(<ListView project={project} />);
    const header = screen.getByRole("button", { name: /^To Do/ });
    header.focus();

    fireEvent.click(header);
    expect(header).toHaveFocus();
    expect(
      screen.queryByRole("button", { name: "Toggle parent" }),
    ).not.toBeInTheDocument();

    fireEvent.click(header);
    expect(header).toHaveFocus();
    expect(
      screen.getByRole("button", { name: "Toggle parent" }),
    ).toBeInTheDocument();
  });
});

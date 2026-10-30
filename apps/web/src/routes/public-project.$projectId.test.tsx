import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { Route } from "./public-project.$projectId";
const m = vi.hoisted(() => ({
  project: undefined as ProjectWithTasks | undefined,
  modal: {} as { task?: Task | null; open?: boolean },
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useParams: () => ({ projectId: "p" }),
  }),
}));
vi.mock("@/hooks/queries/project/use-get-public-project", () => ({
  default: () => ({ data: m.project, isLoading: false }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/public-project/project-description", () => ({
  PublicProjectDescription: () => null,
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("@/components/public-project/kanban-view", () => ({
  PublicKanbanView: ({
    project,
    onTaskClick,
  }: {
    project: ProjectWithTasks;
    onTaskClick: (task: Task) => void;
  }) => (
    <button
      onClick={() => {
        const task = project.columns[0]?.tasks[0];
        if (task) onTaskClick(task);
      }}
    >
      Open task
    </button>
  ),
}));
vi.mock("@/components/public-project/list-view", () => ({
  PublicListView: () => null,
}));
vi.mock("@/components/public-project/task-detail-modal", () => ({
  PublicTaskDetailModal: (props: typeof m.modal) => {
    m.modal = props;
    return props.open ? (
      <output data-testid="detail">
        {props.task?.labels?.map((label) => label.name).join(",")}
      </output>
    ) : null;
  },
}));
afterEach(cleanup);
it("updates an open task dialog as related pages hydrate and closes when the task disappears", () => {
  localStorage.setItem("kaneo-public-view-mode", "kanban");
  const task = {
    id: "task",
    title: "Card",
    labels: [{ id: "one", name: "First", color: "red" }],
    externalLinks: [],
  } as unknown as Task;
  m.project = {
    id: "p",
    name: "Public",
    slug: "PUB",
    icon: null,
    description: null,
    columns: [{ id: "todo", tasks: [task] }],
    plannedTasks: [],
    archivedTasks: [],
  } as unknown as ProjectWithTasks;
  const Component = Route.options.component as ComponentType;
  const { rerender } = render(<Component />);
  fireEvent.click(screen.getByText("Open task"));
  expect(screen.getByTestId("detail").textContent).toBe("First");
  const hydrated = {
    ...task,
    labels: [...task.labels!, { id: "two", name: "Second", color: "blue" }],
    externalLinks: [{ id: "pr", title: "Pull request" }],
  } as Task;
  m.project = {
    ...m.project,
    columns: [{ ...m.project.columns[0], tasks: [hydrated] }],
  };
  rerender(<Component />);
  expect(screen.getByTestId("detail").textContent).toBe("First,Second");
  expect(m.modal.task?.externalLinks).toEqual(hydrated.externalLinks);
  m.project = {
    ...m.project,
    columns: [{ ...m.project.columns[0], tasks: [] }],
  };
  rerender(<Component />);
  expect(m.modal.task).toBeNull();
  expect(m.modal.open).toBe(false);
});

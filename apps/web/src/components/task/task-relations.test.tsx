import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@/lib/http-error";
import TaskRelations from "./task-relations";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  canUpdateTasks: vi.fn(),
  createRelation: vi.fn(),
  deleteRelation: vi.fn(),
  taskRelations: vi.fn(),
  projectTasks: vi.fn(),
  project: vi.fn(),
  globalSearch: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { project?: string; defaultValue?: string }) =>
      opts?.project ? `${key}:${opts.project}` : (opts?.defaultValue ?? key),
  }),
}));
vi.mock("@/hooks/mutations/task-relation/use-create-task-relation", () => ({
  default: () => ({ mutateAsync: mocks.createRelation }),
}));
vi.mock("@/hooks/mutations/task-relation/use-delete-task-relation", () => ({
  default: () => ({ mutate: mocks.deleteRelation }),
}));
vi.mock("@/hooks/queries/project/use-get-project", () => ({
  default: () => mocks.project(),
}));
vi.mock("@/hooks/queries/search/use-global-search", () => ({
  default: (params: unknown) => mocks.globalSearch(params),
}));
vi.mock("@/hooks/queries/task/use-get-tasks", () => ({
  useGetTasks: () => mocks.projectTasks(),
}));
vi.mock("@/hooks/queries/task-relation/use-get-task-relations", () => ({
  default: () => mocks.taskRelations(),
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { id: "workspace-1" } }),
}));
vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({
    useGetActiveWorkspaceUsers: () => ({ data: { members: [] } }),
  }),
);
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canUpdateTasks: mocks.canUpdateTasks }),
}));
vi.mock("@/lib/toast", () => ({
  toast: { error: mocks.toastError, success: vi.fn() },
}));
vi.mock("./subtask-status-popover", () => ({
  default: (props: { projectId: string; children: React.ReactNode }) => (
    <div data-testid="status-popover" data-project-id={props.projectId}>
      {props.children}
    </div>
  ),
}));
vi.mock("./subtask-assignee-popover", () => ({
  default: (props: { children: React.ReactNode }) => <>{props.children}</>,
}));

const CURRENT_PROJECT_ID = "project-current";

// A column of the CURRENT project happens to share its id/slug with the
// other project's status below — the fixture that makes it obvious whether
// a fix compares project ids or merely looks the status id up by string.
const CURRENT_PROJECT_COLUMNS = [
  {
    id: "done",
    icon: "check-circle",
    isFinal: true,
    tasks: [],
  },
];

function otherProjectRelation() {
  return {
    id: "relation-1",
    relationType: "related",
    sourceTaskId: "task-current",
    targetTaskId: "task-other",
    sourceTask: null,
    targetTask: {
      id: "task-other",
      title: "Fix the other project's bug",
      status: "done",
      priority: null,
      number: 7,
      projectId: "project-other",
      userId: null,
      assigneeName: null,
    },
  };
}

function sameProjectRelation() {
  return {
    id: "relation-2",
    relationType: "related",
    sourceTaskId: "task-current",
    targetTaskId: "task-same",
    sourceTask: null,
    targetTask: {
      id: "task-same",
      title: "Fix a bug here",
      status: "to-do",
      priority: null,
      number: 3,
      projectId: CURRENT_PROJECT_ID,
      userId: null,
      assigneeName: null,
    },
  };
}

beforeEach(() => {
  mocks.canUpdateTasks.mockReturnValue(true);
  mocks.project.mockReturnValue({ data: { slug: "CUR" } });
  mocks.projectTasks.mockReturnValue({
    data: { columns: CURRENT_PROJECT_COLUMNS },
  });
  mocks.globalSearch.mockReturnValue({ data: undefined });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderRelations() {
  render(
    <TaskRelations
      taskId="task-current"
      projectId={CURRENT_PROJECT_ID}
      workspaceId="workspace-1"
    />,
  );
}

describe("TaskRelations cross-project correctness", () => {
  it("navigates using the related task's own project id, not the current one", () => {
    mocks.taskRelations.mockReturnValue({ data: [otherProjectRelation()] });

    renderRelations();
    fireEvent.click(
      screen.getByRole("button", { name: "Fix the other project's bug" }),
    );

    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          workspaceId: "workspace-1",
          projectId: "project-other",
          taskId: "task-other",
        }),
      }),
    );
  });

  it("navigates using the current project id for a same-project relation", () => {
    mocks.taskRelations.mockReturnValue({ data: [sameProjectRelation()] });

    renderRelations();
    fireEvent.click(screen.getByRole("button", { name: "Fix a bug here" }));

    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          projectId: CURRENT_PROJECT_ID,
          taskId: "task-same",
        }),
      }),
    );
  });

  it("makes the status control read-only for a task from another project", () => {
    mocks.taskRelations.mockReturnValue({ data: [otherProjectRelation()] });

    renderRelations();

    // No editable popover wired up for the cross-project item...
    expect(screen.queryByTestId("status-popover")).not.toBeInTheDocument();
    // ...but a (non-interactive) status button is still shown.
    expect(
      screen.getByTitle("tasks:relations.crossProjectStatusReadOnly"),
    ).toBeInTheDocument();
  });

  it("keeps the editable status popover, scoped to the current project, for a same-project item", () => {
    mocks.taskRelations.mockReturnValue({ data: [sameProjectRelation()] });

    renderRelations();

    const popover = screen.getByTestId("status-popover");
    expect(popover).toHaveAttribute("data-project-id", CURRENT_PROJECT_ID);
  });

  it("does not strike through or reuse the current project's column icon for a same-id status in another project", () => {
    // task-other's status ("done") collides with a FINAL column id in the
    // CURRENT project; a fix that only compares status strings (not
    // projectId) would incorrectly treat it as final here too.
    mocks.taskRelations.mockReturnValue({ data: [otherProjectRelation()] });

    renderRelations();

    const title = screen.getByText("Fix the other project's bug");
    expect(title.className).not.toContain("line-through");
  });

  it("trims the search query before sending it to global search", () => {
    mocks.taskRelations.mockReturnValue({ data: [] });
    renderRelations();

    fireEvent.click(screen.getByRole("button", { name: "" }));
    const input = screen.getByPlaceholderText(
      "tasks:relations.searchPlaceholder",
    );
    fireEvent.change(input, { target: { value: "  bug  " } });

    const lastCall =
      mocks.globalSearch.mock.calls[mocks.globalSearch.mock.calls.length - 1];
    expect(lastCall[0]).toEqual(expect.objectContaining({ q: "bug" }));
  });
});

describe("TaskRelations link errors", () => {
  function availableTask() {
    return {
      id: "task-b",
      title: "Task B",
      status: "done",
      priority: null,
      number: 2,
      projectId: CURRENT_PROJECT_ID,
      userId: null,
      assigneeName: null,
    };
  }

  function openPickerAndLinkTask() {
    renderRelations();
    fireEvent.click(screen.getByRole("button", { name: "" }));
    fireEvent.click(screen.getByText("Task B"));
  }

  beforeEach(() => {
    mocks.taskRelations.mockReturnValue({ data: [] });
    mocks.projectTasks.mockReturnValue({
      data: {
        columns: [{ ...CURRENT_PROJECT_COLUMNS[0], tasks: [availableTask()] }],
      },
    });
  });

  it("shows the circular-dependency message for a 409 that would close a cycle", async () => {
    mocks.createRelation.mockRejectedValueOnce(
      new HttpError(409, "This dependency would create a circular dependency"),
    );

    openPickerAndLinkTask();

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "tasks:relations.circularDependencyError",
      ),
    );
  });

  it("falls back to the generic link-error message for any other failure", async () => {
    mocks.createRelation.mockRejectedValueOnce(
      new HttpError(409, "This relation already exists"),
    );

    openPickerAndLinkTask();

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "tasks:relations.linkError",
      ),
    );
  });
});

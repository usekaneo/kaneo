import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import TaskDetailsContent from "./task-details-content";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  getProject: vi.fn(),
  getRelations: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/project/use-get-project", () => ({
  default: (params: { id: string; workspaceId: string }) =>
    mocks.getProject(params),
}));
vi.mock("@/hooks/queries/task/use-get-task", () => ({
  default: () => ({ data: undefined }),
}));
vi.mock("@/hooks/queries/task-relation/use-get-task-relations", () => ({
  default: () => mocks.getRelations(),
}));
vi.mock("@/hooks/queries/external-link/use-external-links", () => ({
  default: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/components/external-links/external-links-accordion", () => ({
  ExternalLinksAccordion: () => null,
}));
vi.mock("./task-activity", () => ({ TaskActivity: () => null }));
vi.mock("./task-description", () => ({ default: () => null }));
vi.mock("./task-relations", () => ({ default: () => null }));
vi.mock("./task-subtasks", () => ({ default: () => null }));
vi.mock("./task-title", () => ({ default: () => null }));

beforeEach(() => {
  mocks.getRelations.mockReturnValue({
    data: [
      {
        relationType: "subtask",
        sourceTaskId: "parent",
        targetTaskId: "child",
        sourceTask: {
          id: "parent",
          title: "Parent task",
          number: 5,
          projectId: "life",
        },
      },
    ],
  });
  mocks.getProject.mockImplementation(({ id }: { id: string }) => ({
    data: id ? { id, slug: id === "life" ? "LIF" : "HOM" } : undefined,
  }));
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function renderChild(projectId = "home") {
  return render(
    <TaskDetailsContent
      taskId="child"
      projectId={projectId}
      workspaceId="workspace"
    />,
  );
}

describe("parent task link", () => {
  it.each(["home", "life"])(
    "uses the parent's project when the child belongs to %s",
    (projectId) => {
      renderChild(projectId);
      const button = screen.getByRole("button", {
        name: /tasks:detail\.subtaskOf\s*LIF-5\s*Parent task/,
      });
      expect(screen.queryByText("HOM-5")).not.toBeInTheDocument();
      fireEvent.click(button);
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
        params: {
          workspaceId: "workspace",
          projectId: "life",
          taskId: "parent",
        },
      });
    },
  );

  it("opens the parent even while its project is loading", () => {
    mocks.getProject.mockReturnValue({ data: undefined });
    renderChild();
    fireEvent.click(
      screen.getByRole("button", {
        name: /tasks:detail\.subtaskOf\s*Parent task/,
      }),
    );
    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        params: {
          workspaceId: "workspace",
          projectId: "life",
          taskId: "parent",
        },
      }),
    );
  });
});

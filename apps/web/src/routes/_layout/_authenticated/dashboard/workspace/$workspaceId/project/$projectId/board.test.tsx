import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { Route } from "./board";
const m = vi.hoisted(() => ({
  project: {
    id: "p",
    name: "Project",
    columns: [],
    plannedTasks: [],
    archivedTasks: [],
  } as unknown,
  retry: vi.fn(),
  viewMode: "board" as "board" | "list",
  isError: true,
  isFetching: false,
  isSuccess: false,
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    ...(options as object),
    useParams: () => ({ projectId: "p", workspaceId: "w" }),
    useSearch: () => ({}),
  }),
  useNavigate: () => vi.fn(),
}));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/task/use-get-tasks", () => ({
  useGetTasks: () => ({
    data: m.project,
    isError: m.isError,
    isFetching: m.isFetching,
    isSuccess: m.isSuccess,
    refetch: m.retry,
  }),
}));
vi.mock("@/store/project", () => ({
  default: () => ({ project: m.project, setProject: vi.fn() }),
}));
vi.mock("@/store/user-preferences", () => ({
  useUserPreferencesStore: (
    selector: (state: { viewMode: "board" | "list" }) => unknown,
  ) => selector({ viewMode: m.viewMode }),
}));
vi.mock("@/store/background", () => ({
  useBackgroundStore: () => ({ background: null }),
}));
vi.mock("@/hooks/use-board-sort", () => ({
  useBoardSort: () => ({ sort: { field: "position" }, setSort: vi.fn() }),
}));
vi.mock("@/components/project/toolbar/use-project-task-view", () => ({
  useProjectTaskView: () => ({
    search: "",
    setSearch: vi.fn(),
    descriptionSearch: { isLoading: false, isError: false, retry: vi.fn() },
    filters: { filteredProject: m.project, clearFilters: vi.fn() },
    subjects: [],
  }),
}));
vi.mock("@/components/common/project-layout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/kanban-board", () => ({
  default: ({ disableDragDrop }: { disableDragDrop: boolean }) => (
    <div aria-label="Cached board" data-drag-disabled={disableDragDrop}>
      Cached task
    </div>
  ),
}));
vi.mock("@/components/list-view", () => ({
  default: ({ disableDragDrop }: { disableDragDrop: boolean }) => (
    <div aria-label="Project list" data-drag-disabled={disableDragDrop} />
  ),
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("@/components/shared/modals/create-task-modal", () => ({
  default: () => null,
}));
vi.mock("@/components/task/task-details-sheet", () => ({
  default: () => null,
}));
afterEach(() => {
  cleanup();
  m.viewMode = "board";
  m.isError = true;
  m.isFetching = false;
  m.isSuccess = false;
});
it("keeps cached tasks readable and disables reordering when a refresh fails", () => {
  const Component = (Route as unknown as { component: ComponentType })
    .component;
  render(<Component />);
  expect(screen.getByText("Cached task")).toBeDefined();
  expect(
    screen.getByLabelText("Cached board").getAttribute("data-drag-disabled"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "tasks:board.tryAgain" }));
  expect(m.retry).toHaveBeenCalledOnce();
});

it("keeps list moves enabled while a complete board refetches", () => {
  m.viewMode = "list";
  m.isError = false;
  m.isFetching = true;
  const Component = (Route as unknown as { component: ComponentType })
    .component;
  const { rerender } = render(<Component />);
  const list = screen.getByLabelText("Project list");
  expect(list.getAttribute("data-drag-disabled")).toBe("true");

  m.isSuccess = true;
  rerender(<Component />);
  expect(list.getAttribute("data-drag-disabled")).toBe("false");
});

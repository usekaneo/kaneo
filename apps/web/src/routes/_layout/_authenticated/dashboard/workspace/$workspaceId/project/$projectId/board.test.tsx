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
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    ...(options as object),
    useParams: () => ({ projectId: "p", workspaceId: "w" }),
    useSearch: () => ({}),
  }),
  useNavigate: () => vi.fn(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/task/use-get-tasks", () => ({
  useGetTasks: () => ({
    data: m.project,
    isError: true,
    isFetching: false,
    refetch: m.retry,
  }),
}));
vi.mock("@/store/project", () => ({
  default: () => ({ project: m.project, setProject: vi.fn() }),
}));
vi.mock("@/store/user-preferences", () => ({
  useUserPreferencesStore: () => ({ viewMode: "board", setViewMode: vi.fn() }),
}));
vi.mock("@/store/background", () => ({
  useBackgroundStore: () => ({ background: null }),
}));
vi.mock("@/hooks/use-board-sort", () => ({
  useBoardSort: () => ({ sort: { field: "position" }, setSort: vi.fn() }),
}));
vi.mock("@/hooks/use-keyboard-shortcuts", () => ({
  useRegisterShortcuts: vi.fn(),
  getModifierKeyText: () => "Ctrl",
}));
vi.mock("@/hooks/queries/task/use-description-matches", () => ({
  useDescriptionMatches: () => ({ ids: [], isLoading: false, isError: false }),
}));
vi.mock("@/hooks/use-task-filters-with-labels-support", () => ({
  useTaskFiltersWithLabelsSupport: () => ({
    filteredProject: m.project,
    filters: {},
    hasActiveFilters: false,
  }),
}));
vi.mock(
  "@/hooks/queries/custom-field/use-get-custom-fields-by-project",
  () => ({ default: () => ({ data: [] }) }),
);
vi.mock(
  "@/hooks/queries/custom-field/use-get-custom-field-filter-values",
  () => ({ default: () => ({ data: [] }) }),
);
vi.mock("@/hooks/queries/label/use-get-labels-by-workspace", () => ({
  default: () => ({ data: [] }),
}));
vi.mock(
  "@/hooks/queries/workspace-users/use-get-active-workspace-users",
  () => ({ useGetActiveWorkspaceUsers: () => ({ data: [] }) }),
);
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
vi.mock("@/components/board/board-toolbar", () => ({ default: () => null }));
vi.mock("@/components/list-view", () => ({ default: () => null }));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("@/components/shared/modals/create-task-modal", () => ({
  default: () => null,
}));
vi.mock("@/components/task/task-details-sheet", () => ({
  default: () => null,
}));
afterEach(cleanup);
it("keeps cached tasks readable and disables reordering when a refresh fails", () => {
  const Component = (Route as unknown as { component: ComponentType })
    .component;
  render(<Component />);
  expect(screen.getByText("Cached task")).toBeDefined();
  expect(
    screen.getByLabelText("Cached board").getAttribute("data-drag-disabled"),
  ).toBe("true");
  fireEvent.click(
    screen.getByRole("button", { name: "tasks:descriptionRetry" }),
  );
  expect(m.retry).toHaveBeenCalledOnce();
});

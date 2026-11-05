import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { ProjectToolbar } from "./project-toolbar";
import type { ProjectTaskView } from "./use-project-task-view";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/project/display/display-menu", () => ({
  DisplayMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/project/task-filters/filter-menu", () => ({
  FilterMenu: () => null,
}));
vi.mock("@/components/project/task-filters/use-filter-shortcuts", () => ({
  useFilterShortcuts: vi.fn(),
}));
vi.mock("./project-search", () => ({ ProjectSearch: () => null }));
afterEach(cleanup);

it("clears the subtask override and disables reset when following the project default", () => {
  const setIncludeSubtasks = vi.fn();
  const view = {
    search: "",
    setSearch: vi.fn(),
    subjects: [],
    filters: {
      includeSubtasks: true,
      hasIncludeSubtasksOverride: true,
      setIncludeSubtasks,
      activeFilterCount: 0,
      clearFilters: vi.fn(),
    },
  } as unknown as ProjectTaskView;
  const { rerender } = render(<ProjectToolbar view={view} display={null} />);
  const reset = screen.getByRole("button", {
    name: "tasks:display.useProjectDefault",
  });
  expect(reset).toBeEnabled();
  fireEvent.click(reset);
  expect(setIncludeSubtasks).toHaveBeenCalledWith(null);
  rerender(
    <ProjectToolbar
      view={{
        ...view,
        filters: {
          ...view.filters,
          includeSubtasks: false,
          hasIncludeSubtasksOverride: false,
        },
      }}
      display={null}
    />,
  );
  expect(reset).toBeDisabled();
  expect(
    screen.getByRole("switch", { name: "tasks:display.includeSubtasks" }),
  ).not.toBeChecked();
});

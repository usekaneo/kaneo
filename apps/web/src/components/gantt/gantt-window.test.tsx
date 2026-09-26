import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  component: (() => null) as ComponentType,
  navigate: vi.fn(),
  update: vi.fn(),
  tasks: [] as Record<string, unknown>[],
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: ComponentType }) => {
    m.component = options.component;
    return {
      useParams: () => ({ projectId: "project", workspaceId: "workspace" }),
      useSearch: () => ({}),
    };
  },
  useNavigate: () => m.navigate,
}));
vi.mock("@/components/common/project-layout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("@/components/task/task-details-sheet", () => ({
  default: () => null,
}));
vi.mock("@/hooks/queries/task/use-get-tasks", () => ({
  useGetTasks: () => ({
    data: {
      name: "Project",
      slug: "PROJ",
      columns: [{ tasks: m.tasks }],
      plannedTasks: [],
    },
  }),
}));
vi.mock("@/hooks/mutations/task/use-update-task", () => ({
  useUpdateTask: () => ({ mutateAsync: m.update }),
}));
vi.mock("@/hooks/mutations/task/use-bulk-update-task-schedule", () => ({
  useBulkUpdateTaskSchedule: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/mutations/task-relation/use-create-task-relation", () => ({
  default: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/queries/task-relation/use-get-project-task-relations", () => ({
  default: () => ({ data: [] }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
const preferencesState = vi.hoisted(() => ({
  weekStartsOn: 1 as const,
  ganttTimelineUnit: "day" as const,
  setGanttTimelineUnit: vi.fn(),
}));
vi.mock("@/store/user-preferences", () => ({
  useUserPreferencesStore: (
    selector: (state: typeof preferencesState) => unknown,
  ) => selector(preferencesState),
}));
vi.mock("@/lib/i18n/domain", () => ({
  getStatusLabel: (status: string) => status,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));

await import(
  "@/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/gantt"
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("PointerEvent", MouseEvent);
});
function task(
  id: string,
  startDate: string,
  dueDate: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    projectId: "project",
    title: id,
    number: 1,
    status: "to-do",
    startDate,
    dueDate,
    description: "",
    labels: [],
    priority: "low",
    position: 1,
    progress: 0,
    isMilestone: false,
    baselineStartDate: null,
    baselineDueDate: null,
    ...overrides,
  };
}
function show() {
  const Component = m.component;
  return render(<Component />);
}

describe("Gantt window UI", () => {
  it("renders a bounded grid for a centuries-long legacy task and makes clipped bars safe to open", () => {
    m.tasks = [task("Long-lived", "0001-01-01", "9999-12-31")];
    const { container } = show();
    const grids = Array.from(
      container.querySelectorAll<HTMLElement>(
        '[style*="grid-template-columns: repeat"]',
      ),
    );
    expect(grids.length).toBeGreaterThan(0);
    expect(
      grids.every((grid) => /repeat\(91,/.test(grid.style.gridTemplateColumns)),
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: "tasks:gantt.resizeStart" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "tasks:gantt.resizeDue" }),
    ).toBeDisabled();
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "tasks:gantt.taskAriaLabel" }),
      { button: 0 },
    );
    expect(m.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ search: { taskId: "Long-lived" } }),
    );
    expect(m.update).not.toHaveBeenCalled();
  });

  it("can jump to a far-away task and navigate without losing its row", () => {
    m.tasks = [
      task("Ancient", "0001-01-01", "0001-01-02"),
      task("Future", "9999-12-30", "9999-12-31"),
    ];
    const { container } = show();
    const jump = screen.getAllByRole("button", {
      name: "tasks:gantt.showTaskDates",
    });
    expect(jump).toHaveLength(2);
    fireEvent.click(jump[1]);
    expect(screen.getByLabelText("tasks:gantt.periodStart")).toHaveValue(
      "9999-10-02",
    );
    expect(
      screen.getByRole("button", { name: "tasks:gantt.nextPeriod" }),
    ).toBeDisabled();
    expect(screen.getByText("Ancient")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:gantt.previousPeriod" }),
    );
    expect(
      screen.getByRole("button", { name: "tasks:gantt.nextPeriod" }),
    ).not.toBeDisabled();
    expect(
      container.querySelectorAll('[style*="repeat(91,"]').length,
    ).toBeGreaterThan(0);
  });

  it("supports entering a date directly while keeping the allocated period bounded", () => {
    m.tasks = [task("Long-lived", "0001-01-01", "9999-12-31")];
    const { container } = show();
    fireEvent.change(screen.getByLabelText("tasks:gantt.periodStart"), {
      target: { value: "2050-01-01" },
    });
    expect(screen.getByLabelText("tasks:gantt.periodStart")).toHaveValue(
      "2050-01-01",
    );
    expect(
      container.querySelectorAll('[style*="repeat(91,"]').length,
    ).toBeGreaterThan(0);
  });

  it("shades the completed portion of a task bar according to its progress", () => {
    m.tasks = [task("Partial", "2026-09-14", "2026-09-18", { progress: 40 })];
    const { container } = show();
    expect(
      container.querySelector('[style*="width: 40%"]'),
    ).toBeInTheDocument();
  });

  it("does not shade a task bar with no progress", () => {
    m.tasks = [task("Fresh", "2026-09-14", "2026-09-18", { progress: 0 })];
    const { container } = show();
    expect(container.querySelector('[style*="width: 0%"]')).toBeNull();
  });

  it("renders a milestone task as a diamond marker instead of a span bar", () => {
    m.tasks = [
      task("Kickoff", "2026-09-15", "2026-09-15", { isMilestone: true }),
    ];
    show();
    expect(
      screen.getByRole("button", {
        name: "tasks:gantt.milestoneAriaLabel",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "tasks:gantt.resizeStart" }),
    ).not.toBeInTheDocument();
  });

  it("renders a thin baseline underlay beneath a task that has one set", () => {
    m.tasks = [
      task("Drifted", "2026-09-16", "2026-09-20", {
        baselineStartDate: "2026-09-14",
        baselineDueDate: "2026-09-18",
      }),
    ];
    const { container } = show();
    expect(
      container.querySelector('[title="tasks:properties.baseline"]'),
    ).toBeInTheDocument();
  });

  it("omits the baseline underlay when no baseline is set", () => {
    m.tasks = [task("NoBaseline", "2026-09-16", "2026-09-20")];
    const { container } = show();
    expect(
      container.querySelector('[title="tasks:properties.baseline"]'),
    ).toBeNull();
  });
});

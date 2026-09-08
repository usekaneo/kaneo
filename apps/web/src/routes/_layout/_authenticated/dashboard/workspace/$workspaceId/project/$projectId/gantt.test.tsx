import enUS from "@i18n/en-US.json";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Task from "@/types/task";
import { Route } from "./gantt";

// jsdom does not implement either of these; the component relies on both to
// center the timeline on "today".
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
const scrollIntoView = vi.fn();
Element.prototype.scrollIntoView = scrollIntoView;

const navigate = vi.fn();

// A plain mutable object rather than a per-test vi.fn() mock: the Gantt
// project selector swaps `projectId` on the same route (no remount), so
// tests that exercise that need to change what `useParams` returns between
// renders of the *same* render() call, which a fresh mockReturnValue can't
// do retroactively.
const routeParams = { workspaceId: "workspace-1", projectId: "project-1" };

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    ...(options as Record<string, unknown>),
    useParams: () => routeParams,
    useSearch: () => ({ taskId: undefined }),
  }),
  useNavigate: () => navigate,
}));

const useGetTasks = vi.fn();
vi.mock("@/hooks/queries/task/use-get-tasks", () => ({
  useGetTasks: (projectId: string) => useGetTasks(projectId),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/store/user-preferences", () => ({
  useUserPreferencesStore: (
    selector: (state: { weekStartsOn: number }) => unknown,
  ) => selector({ weekStartsOn: 0 }),
}));

vi.mock("@/components/common/project-layout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/task/task-details-sheet", () => ({
  default: () => null,
}));

vi.mock("@/components/page-title", () => ({
  default: () => null,
}));

vi.mock("@/components/gantt/gantt-task-bar", () => ({
  GanttTaskBar: ({ task }: { task: { title: string } }) => (
    <div>{task.title}</div>
  ),
}));

// Resolves against the real en-US bundle, so the assertions fail if the
// jumpToToday key (or its interpolated siblings) stops matching what the
// component actually requests.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const [namespace, path] = key.split(":");
      const source = path
        .split(".")
        .reduce<unknown>(
          (accumulator, part) =>
            (accumulator as Record<string, unknown> | undefined)?.[part],
          (enUS as Record<string, unknown>)[namespace],
        );

      if (typeof source !== "string") return key;

      return source.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
        String(options?.[name] ?? `{{${name}}}`),
      );
    },
  }),
}));

const GanttRoute = (Route as unknown as { component: ComponentType }).component;

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "task-1",
    title: "Task",
    number: 1,
    description: null,
    status: "in-progress",
    priority: null,
    startDate: null,
    dueDate: null,
    position: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    userId: null,
    assigneeId: null,
    assigneeName: null,
    projectId: "project-1",
    ...overrides,
  };
}

function mockProjectWithTask(
  task: Task,
  overrides: { id?: string; name?: string } = {},
) {
  useGetTasks.mockReturnValue({
    data: {
      id: overrides.id ?? "project-1",
      name: overrides.name ?? "Roadmap",
      slug: "RM",
      columns: [{ id: "col-1", name: "In Progress", tasks: [task] }],
      plannedTasks: [],
      archivedTasks: [],
    },
  });
}

beforeEach(() => {
  // Fixed "today" so the timeline range and isToday() checks are
  // deterministic regardless of when the suite runs.
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 31));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  scrollIntoView.mockClear();
  useGetTasks.mockReset();
  routeParams.projectId = "project-1";
});

describe("Gantt jump-to-today", () => {
  it("centers a new project after a search stops hiding its timeline", () => {
    mockProjectWithTask(
      makeTask({
        title: "First task",
        startDate: "2026-08-28",
        dueDate: "2026-09-02",
      }),
    );
    const { rerender } = render(<GanttRoute />);
    const search = screen.getByPlaceholderText("Search scheduled tickets...");
    fireEvent.change(search, { target: { value: "no match" } });
    routeParams.projectId = "project-2";
    mockProjectWithTask(
      makeTask({
        title: "Second task",
        startDate: "2026-08-28",
        dueDate: "2026-09-02",
      }),
      { id: "project-2" },
    );
    rerender(<GanttRoute />);

    fireEvent.change(search, { target: { value: "" } });

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView).toHaveBeenLastCalledWith(
      expect.objectContaining({ behavior: "auto", inline: "center" }),
    );
  });
  it("disables the button and never auto-scrolls when no task falls near today", () => {
    mockProjectWithTask(
      makeTask({
        id: "past-task",
        title: "Old milestone",
        startDate: "2026-05-01",
        dueDate: "2026-05-03",
      }),
    );

    render(<GanttRoute />);

    const button = screen.getByRole("button", { name: "Jump to today" });
    expect(button).toBeDisabled();
    expect(scrollIntoView).not.toHaveBeenCalled();

    fireEvent.click(button);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("auto-centers on today and re-centers on demand when today is in range", () => {
    mockProjectWithTask(
      makeTask({
        id: "current-task",
        title: "Ongoing work",
        startDate: "2026-08-28",
        dueDate: "2026-09-02",
      }),
    );

    render(<GanttRoute />);

    // The mount-time effect scrolls today's column into view without
    // animating, so it doesn't fight the user for scroll position on load.
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenLastCalledWith(
      expect.objectContaining({ behavior: "auto", inline: "center" }),
    );

    const button = screen.getByRole("button", { name: "Jump to today" });
    expect(button).not.toBeDisabled();

    fireEvent.click(button);

    // A manual click animates instead, so its intent reads as a deliberate
    // jump rather than the page settling into place.
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView).toHaveBeenLastCalledWith(
      expect.objectContaining({ behavior: "smooth", inline: "center" }),
    );
  });

  it("re-arms auto-centering after switching to a different project on the same route", () => {
    mockProjectWithTask(
      makeTask({
        id: "current-task",
        title: "Ongoing work",
        startDate: "2026-08-28",
        dueDate: "2026-09-02",
      }),
    );

    const { rerender } = render(<GanttRoute />);

    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    // The in-page Gantt project selector changes `projectId` without
    // unmounting this route component, so a fresh task near today on the
    // newly selected project must still trigger the mount-time auto-center —
    // the one-time guard from the previous project shouldn't carry over.
    routeParams.projectId = "project-2";
    mockProjectWithTask(
      makeTask({
        id: "other-project-task",
        title: "Other project's work",
        startDate: "2026-08-30",
        dueDate: "2026-09-03",
      }),
      { id: "project-2", name: "Other roadmap" },
    );

    rerender(<GanttRoute />);

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView).toHaveBeenLastCalledWith(
      expect.objectContaining({ behavior: "auto", inline: "center" }),
    );
  });

  it("disables the button once a search filters out every task, even with today in range", () => {
    mockProjectWithTask(
      makeTask({
        id: "current-task",
        title: "Ongoing work",
        startDate: "2026-08-28",
        dueDate: "2026-09-02",
      }),
    );

    render(<GanttRoute />);

    const button = screen.getByRole("button", { name: "Jump to today" });
    expect(button).not.toBeDisabled();

    // The search narrows the *visible* timeline down to nothing, even though
    // today is still within the unfiltered project's date range — the button
    // has nothing left to scroll to and must reflect that.
    fireEvent.change(
      screen.getByPlaceholderText("Search scheduled tickets..."),
      {
        target: { value: "no such task" },
      },
    );

    expect(
      screen.getByText('No scheduled tasks match "no such task"'),
    ).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it("insets scroll-alignment by the task rail's width so a scrollIntoView center lands in the visible timeline", () => {
    mockProjectWithTask(
      makeTask({
        id: "current-task",
        title: "Ongoing work",
        startDate: "2026-08-28",
        dueDate: "2026-09-02",
      }),
    );

    render(<GanttRoute />);

    // The task rail renders at a fixed 20rem on desktop (see the `left`
    // offset used by the timeline track below it); scroll-padding has to
    // match that exactly, or "centering" on today still lands it partway
    // under the rail.
    //
    // Asserted against the raw inline style rather than via `toHaveStyle`:
    // jsdom resolves `getComputedStyle()` rem units to pixels (assuming the
    // default 16px root), which would make a "20rem" expectation compare
    // against a computed "320px" and fail regardless of whether the
    // component is correct.
    const container = screen.getByTestId("gantt-scroll-container");
    expect(container.style.scrollPaddingLeft).toBe("20rem");
  });
});

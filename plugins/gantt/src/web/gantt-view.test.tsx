import type { ButtonProps, InputProps } from "@kaneo/plugin-sdk/ui";
import type { PluginProject, PluginTask } from "@kaneo/plugin-sdk/web";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { GanttView } from "./gantt-view.js";
import { enUS } from "./translations/en-US.js";

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

const sdk = vi.hoisted(() => ({
  useTasks: vi.fn(),
  useProject: vi.fn(),
  openTask: vi.fn(),
}));

vi.mock("@kaneo/plugin-sdk/web", () => ({
  useTasks: (projectId: string) => sdk.useTasks(projectId),
  useProject: (projectId: string) => sdk.useProject(projectId),
  useUpdateTask: () => vi.fn(),
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
  usePreferences: () => ({ weekStartsOn: 0 }),
  useOpenTask: () => sdk.openTask,
  useT:
    () =>
    (key: string, options?: Record<string, unknown>): string => {
      const source = key
        .split(".")
        .reduce<unknown>(
          (accumulator, part) =>
            (accumulator as Record<string, unknown> | undefined)?.[part],
          enUS,
        );

      if (typeof source !== "string") return key;

      return source.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
        String(options?.[name] ?? `{{${name}}}`),
      );
    },
}));

vi.mock("@kaneo/plugin-sdk/ui", () => ({
  Button: ({ variant: _variant, size: _size, ...props }: ButtonProps) => (
    <button type="button" {...props} />
  ),
  Input: (props: InputProps) => <input {...props} />,
}));

vi.mock("./use-is-mobile.js", () => ({
  useIsMobile: () => false,
}));

vi.mock("./gantt-task-bar.js", () => ({
  GanttTaskBar: ({ task }: { task: { title: string } }) => (
    <div>{task.title}</div>
  ),
}));

function makeTask(overrides: Partial<PluginTask>): PluginTask {
  return {
    id: "task-1",
    title: "Task",
    number: 1,
    description: null,
    status: "in-progress",
    priority: null,
    startDate: null,
    dueDate: null,
    assigneeId: null,
    assigneeName: null,
    projectId: "project-1",
    ...overrides,
  };
}

function mockProjectWithTasks(
  tasks: PluginTask[],
  overrides: { id?: string; name?: string } = {},
) {
  const project: PluginProject = {
    id: overrides.id ?? "project-1",
    workspaceId: "workspace-1",
    name: overrides.name ?? "Roadmap",
    slug: "RM",
    columns: [
      {
        id: "col-1",
        name: "In Progress",
        slug: "in-progress",
        isFinal: false,
      },
    ],
  };
  sdk.useTasks.mockReturnValue({ data: tasks, isLoading: false, error: null });
  sdk.useProject.mockReturnValue({
    data: project,
    isLoading: false,
    error: null,
  });
}

function mockProjectWithTask(
  task: PluginTask,
  overrides: { id?: string; name?: string } = {},
) {
  mockProjectWithTasks([task], overrides);
}

function view(projectId = "project-1") {
  return <GanttView workspaceId="workspace-1" projectId={projectId} />;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 31));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  scrollIntoView.mockClear();
  sdk.useTasks.mockReset();
  sdk.useProject.mockReset();
  sdk.openTask.mockReset();
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
    const { rerender } = render(view());
    const search = screen.getByPlaceholderText("Search scheduled tickets...");
    fireEvent.change(search, { target: { value: "no match" } });
    mockProjectWithTask(
      makeTask({
        title: "Second task",
        startDate: "2026-08-28",
        dueDate: "2026-09-02",
      }),
      { id: "project-2" },
    );
    rerender(view("project-2"));

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

    render(view());

    const button = screen.getByRole("button", { name: "Jump to today" });
    expect(button).toHaveProperty("disabled", true);
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

    render(view());

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenLastCalledWith(
      expect.objectContaining({ behavior: "auto", inline: "center" }),
    );

    const button = screen.getByRole("button", { name: "Jump to today" });
    expect(button).toHaveProperty("disabled", false);

    fireEvent.click(button);

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

    const { rerender } = render(view());

    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    mockProjectWithTask(
      makeTask({
        id: "other-project-task",
        title: "Other project's work",
        startDate: "2026-08-30",
        dueDate: "2026-09-03",
      }),
      { id: "project-2", name: "Other roadmap" },
    );

    rerender(view("project-2"));

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

    render(view());

    const button = screen.getByRole("button", { name: "Jump to today" });
    expect(button).toHaveProperty("disabled", false);

    fireEvent.change(
      screen.getByPlaceholderText("Search scheduled tickets..."),
      {
        target: { value: "no such task" },
      },
    );

    expect(
      screen.getByText('No scheduled tasks match "no such task"'),
    ).toBeTruthy();
    expect(button).toHaveProperty("disabled", true);
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

    render(view());

    const container = screen.getByTestId("gantt-scroll-container");
    expect(container.style.scrollPaddingLeft).toBe("20rem");
  });
});

describe("Gantt task rail", () => {
  it("labels rows by column name and task key, and opens the task", () => {
    mockProjectWithTasks([
      makeTask({
        id: "current-task",
        number: 7,
        title: "Ongoing work",
        startDate: "2026-08-28",
        dueDate: "2026-09-02",
        assigneeName: "Ada",
      }),
      makeTask({
        id: "planned-task",
        number: 8,
        title: "Later work",
        status: "planned",
        startDate: "2026-09-01",
        dueDate: "2026-09-04",
      }),
    ]);

    render(view());

    expect(screen.getByText("In Progress")).toBeTruthy();
    expect(screen.getByText("Planned")).toBeTruthy();
    expect(screen.getByText("RM-7")).toBeTruthy();
    expect(screen.getByText("Aug 28, 2026 - Sep 2, 2026 • Ada")).toBeTruthy();

    fireEvent.click(screen.getByText("RM-7"));
    expect(sdk.openTask).toHaveBeenCalledWith("current-task");
  });
});

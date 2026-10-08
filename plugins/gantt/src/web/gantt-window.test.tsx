import type { ButtonProps, InputProps } from "@kaneo/plugin-sdk/ui";
import type { PluginTask } from "@kaneo/plugin-sdk/web";
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

const m = vi.hoisted(() => ({
  openTask: vi.fn(),
  update: vi.fn(),
  tasks: [] as unknown[],
  project: {
    id: "project",
    workspaceId: "workspace",
    name: "Project",
    slug: "PROJ",
    columns: [],
  },
}));
vi.mock("@kaneo/plugin-sdk/web", () => ({
  useTasks: () => ({ data: m.tasks, isLoading: false, error: null }),
  useProject: () => ({ data: m.project, isLoading: false, error: null }),
  useUpdateTask: () => m.update,
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
  usePreferences: () => ({ weekStartsOn: 1 }),
  useOpenTask: () => m.openTask,
  useT: () => (key: string) => key,
}));
vi.mock("@kaneo/plugin-sdk/ui", () => ({
  Button: ({ variant: _variant, size: _size, ...props }: ButtonProps) => (
    <button type="button" {...props} />
  ),
  Input: (props: InputProps) => <input {...props} />,
}));
vi.mock("./use-is-mobile.js", () => ({ useIsMobile: () => false }));

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
function task(id: string, startDate: string, dueDate: string): PluginTask {
  return {
    id,
    projectId: "project",
    title: id,
    number: 1,
    status: "to-do",
    startDate,
    dueDate,
    description: "",
    priority: "low",
    assigneeId: null,
    assigneeName: null,
  };
}
function show() {
  return render(<GanttView workspaceId="workspace" projectId="project" />);
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
    expect(screen.getByRole("button", { name: "resizeStart" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("button", { name: "resizeDue" })).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "taskAriaLabel" }),
      {
        button: 0,
      },
    );
    expect(m.openTask).toHaveBeenCalledWith("Long-lived");
    expect(m.update).not.toHaveBeenCalled();
  });

  it("can jump to a far-away task and navigate without losing its row", () => {
    m.tasks = [
      task("Ancient", "0001-01-01", "0001-01-02"),
      task("Future", "9999-12-30", "9999-12-31"),
    ];
    const { container } = show();
    const jump = screen.getAllByRole("button", { name: "showTaskDates" });
    expect(jump).toHaveLength(2);
    fireEvent.click(jump[1] as HTMLElement);
    expect(screen.getByLabelText("periodStart")).toHaveProperty(
      "value",
      "9999-10-02",
    );
    expect(screen.getByRole("button", { name: "nextPeriod" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByText("Ancient")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "previousPeriod" }));
    expect(screen.getByRole("button", { name: "nextPeriod" })).toHaveProperty(
      "disabled",
      false,
    );
    expect(
      container.querySelectorAll('[style*="repeat(91,"]').length,
    ).toBeGreaterThan(0);
  });

  it("supports entering a date directly while keeping the allocated period bounded", () => {
    m.tasks = [task("Long-lived", "0001-01-01", "9999-12-31")];
    const { container } = show();
    fireEvent.change(screen.getByLabelText("periodStart"), {
      target: { value: "2050-01-01" },
    });
    expect(screen.getByLabelText("periodStart")).toHaveProperty(
      "value",
      "2050-01-01",
    );
    expect(
      container.querySelectorAll('[style*="repeat(91,"]').length,
    ).toBeGreaterThan(0);
  });
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import MonthGrid from "./month-grid";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; title?: string }) => {
      if (key === "tasks:calendar.moreTasks") return `+${options?.count} more`;
      if (key === "tasks:calendar.taskAriaLabel")
        return `${options?.title}: open task`;
      return key;
    },
  }),
}));

afterEach(() => cleanup());

const week = Array.from(
  { length: 7 },
  (_, index) => new Date(2026, 7, 2 + index),
);
const tasks = Array.from({ length: 18 }, (_, index) => ({
  id: `task-${index}`,
  title: `Task ${index}`,
  number: index,
  status: "to-do",
  scheduleStart: week[0],
  scheduleEnd: week[0],
}));

describe("MonthGrid visibility settings", () => {
  it("keeps the default three bars plus an overflow hint", () => {
    render(
      <MonthGrid
        weeks={[week]}
        tasks={tasks}
        visibleMonth={week[0]}
        maxLanes={3}
        onOpenTask={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("button", { name: /open task/ })).toHaveLength(
      3,
    );
    expect(screen.getByText("+15 more")).toBeInTheDocument();
    expect(document.querySelector("[style*='grid-template-rows']")).toHaveClass(
      "flex-1",
    );
  });

  it("keeps capped rows tall enough when only title wrapping is enabled", () => {
    render(
      <MonthGrid
        weeks={[week]}
        tasks={tasks}
        visibleMonth={week[0]}
        maxLanes={3}
        wrapTaskTitles
        onOpenTask={vi.fn()}
      />,
    );
    expect(screen.getByTestId("calendar-day-2026-08-02")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /open task/ })).toHaveLength(
      3,
    );
    expect(screen.getByText("+15 more")).toBeInTheDocument();
  });

  it("renders every task in expanded rows without an overflow hint", () => {
    render(
      <MonthGrid
        weeks={[week]}
        tasks={tasks}
        visibleMonth={week[0]}
        maxLanes={3}
        showAllTasks
        wrapTaskTitles
        onOpenTask={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("button", { name: /open task/ })).toHaveLength(
      18,
    );
    expect(screen.queryByText("+15 more")).not.toBeInTheDocument();
    expect(screen.getByText("Task 17")).toHaveClass("whitespace-normal");
    expect(screen.getByTestId("calendar-day-2026-08-02")).toBeInTheDocument();
  });

  it("stacks wrapped cards independently in each weekday column", () => {
    const extra = [
      {
        id: "short",
        title: "Short task",
        number: 100,
        status: "to-do",
        scheduleStart: week[1],
        scheduleEnd: week[1],
      },
      {
        id: "long",
        title: "An unusually long task title that must wrap onto several lines",
        number: 101,
        status: "to-do",
        scheduleStart: week[2],
        scheduleEnd: week[2],
      },
    ];
    render(
      <MonthGrid
        weeks={[week]}
        tasks={[...tasks, ...extra]}
        visibleMonth={week[0]}
        maxLanes={3}
        wrapTaskTitles
        showAllTasks
        onOpenTask={vi.fn()}
      />,
    );
    const sunday = screen.getByTestId("calendar-day-2026-08-02");
    const monday = screen.getByTestId("calendar-day-2026-08-03");
    const tuesday = screen.getByTestId("calendar-day-2026-08-04");
    expect(sunday.querySelectorAll("button")).toHaveLength(18);
    expect(monday.querySelectorAll("button")).toHaveLength(1);
    expect(tuesday.querySelectorAll("button")).toHaveLength(1);
    expect(monday).toContainElement(screen.getByText("Short task"));
    expect(tuesday).toContainElement(screen.getByText(extra[1].title));
    expect(monday.querySelector("button")).toHaveClass("self-stretch");
    expect(tuesday.querySelector("button")?.style.gridRow).toBe("");
  });

  it("retains multi-day tasks on every covered date when cards are wrapped", () => {
    const spanning = [
      {
        id: "spanning",
        title: "Multi-day",
        number: 200,
        status: "in-progress",
        scheduleStart: week[1],
        scheduleEnd: week[3],
      },
    ];
    render(
      <MonthGrid
        weeks={[week]}
        tasks={spanning}
        visibleMonth={week[0]}
        maxLanes={3}
        wrapTaskTitles
        showAllTasks
        onOpenTask={vi.fn()}
      />,
    );
    expect(screen.getAllByText("Multi-day")).toHaveLength(3);
    expect(screen.getByTestId("calendar-day-2026-08-03")).toContainElement(
      screen.getAllByText("Multi-day")[0],
    );
    expect(screen.getByTestId("calendar-day-2026-08-05")).toContainElement(
      screen.getAllByText("Multi-day")[2],
    );
  });

  it("preserves drag-and-drop between wrapped day columns", () => {
    const onMoveTask = vi.fn();
    render(
      <MonthGrid
        weeks={[week]}
        tasks={tasks}
        visibleMonth={week[0]}
        maxLanes={3}
        wrapTaskTitles
        showAllTasks
        onMoveTask={onMoveTask}
        onOpenTask={vi.fn()}
      />,
    );
    const weekRow = screen.getByTestId(
      "calendar-day-2026-08-02",
    ).parentElement!;
    vi.spyOn(weekRow, "getBoundingClientRect").mockReturnValue({
      left: 0,
      width: 700,
    } as DOMRect);
    const dataTransfer = {
      setData: vi.fn(),
      effectAllowed: "all",
      dropEffect: "none",
    };
    fireEvent.dragStart(
      screen.getByRole("button", { name: "Task 0: open task" }),
      {
        dataTransfer,
      },
    );
    const event = new MouseEvent("drop", {
      bubbles: true,
      cancelable: true,
      clientX: 550,
    });
    Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
    fireEvent(weekRow, event);
    expect(onMoveTask).toHaveBeenCalledWith("task-0", week[5]);
  });

  it("drags a task onto a new calendar day and calls its move handler", () => {
    const onMoveTask = vi.fn();
    const { container } = render(
      <MonthGrid
        weeks={[week]}
        tasks={tasks}
        visibleMonth={week[0]}
        maxLanes={3}
        showAllTasks
        onMoveTask={onMoveTask}
        onOpenTask={vi.fn()}
      />,
    );
    const weekRow = container.querySelector<HTMLElement>(
      "[style*='grid-template-rows']",
    );
    expect(weekRow).not.toBeNull();
    vi.spyOn(weekRow!, "getBoundingClientRect").mockReturnValue({
      left: 0,
      width: 700,
    } as DOMRect);

    const dragData = {
      effectAllowed: "all",
      dropEffect: "none",
      setData: vi.fn(),
    };
    const task = screen.getByRole("button", { name: "Task 0: open task" });
    expect(task).toHaveAttribute("draggable", "true");
    fireEvent.dragStart(task, { dataTransfer: dragData });
    // JSDOM's dragEvent constructor does not expose clientX. A MouseEvent
    // with the drag event type reproduces the browser's pointer coordinates.
    const dispatch = (type: string) => {
      const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: 350,
      });
      Object.defineProperty(event, "dataTransfer", { value: dragData });
      fireEvent(weekRow!, event);
    };
    dispatch("dragover");
    dispatch("drop");

    expect(dragData.setData).toHaveBeenCalledWith("text/plain", "task-0");
    expect(onMoveTask).toHaveBeenCalledExactlyOnceWith("task-0", week[3]);
  });

  it("does not move a task when the drag is cancelled", () => {
    const onMoveTask = vi.fn();
    render(
      <MonthGrid
        weeks={[week]}
        tasks={tasks}
        visibleMonth={week[0]}
        maxLanes={3}
        showAllTasks
        onMoveTask={onMoveTask}
        onOpenTask={vi.fn()}
      />,
    );
    const task = screen.getByRole("button", { name: "Task 0: open task" });
    fireEvent.dragStart(task, {
      dataTransfer: { setData: vi.fn(), effectAllowed: "all" },
    });
    fireEvent.dragEnd(task);
    expect(onMoveTask).not.toHaveBeenCalled();
  });
});

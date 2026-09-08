import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CalendarTask } from "./calendar-task-bar";
import DayOverflowPopover from "./day-overflow-popover";
import MonthGrid from "./month-grid";
import { buildMonthWeeks } from "./month-grid-model";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/format", () => ({
  formatDate: () => "Monday, August 10",
  formatDateShort: (value: Date) => value.toISOString().slice(0, 10),
}));

const TRIGGER_NAME = "tasks:calendar.dayTasksAriaLabel";

function task(
  id: string,
  title: string,
  number: number | null,
  start: Date,
  end: Date,
): CalendarTask {
  return {
    id,
    title,
    number,
    status: "to-do",
    scheduleStart: start,
    scheduleEnd: end,
  };
}

const AUGUST_10 = new Date(2026, 7, 10);

const dayTasks = [
  task("t1", "Design review", 12, new Date(2026, 7, 10), new Date(2026, 7, 12)),
  task("t2", "Ship release", 13, new Date(2026, 7, 10), new Date(2026, 7, 10)),
  task("t3", "Write docs", null, new Date(2026, 7, 9), new Date(2026, 7, 11)),
];

describe("DayOverflowPopover", () => {
  it("keeps the task list closed until the overflow label is clicked", () => {
    render(
      <DayOverflowPopover
        day={AUGUST_10}
        tasks={dayTasks}
        hiddenCount={2}
        projectSlug="KAN"
        onOpenTask={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: TRIGGER_NAME })).toBeVisible();
    expect(screen.queryByText("Design review")).toBeNull();
  });

  it("lists every task for the day, not only the hidden ones", async () => {
    render(
      <DayOverflowPopover
        day={AUGUST_10}
        tasks={dayTasks}
        hiddenCount={2}
        projectSlug="KAN"
        onOpenTask={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: TRIGGER_NAME }));

    expect(await screen.findByText("Design review")).toBeVisible();
    expect(screen.getByText("Ship release")).toBeVisible();
    expect(screen.getByText("Write docs")).toBeVisible();
    expect(screen.getByText("KAN-12")).toBeVisible();
  });

  it("opens the task and closes the popover when an entry is clicked", async () => {
    const onOpenTask = vi.fn();

    render(
      <DayOverflowPopover
        day={AUGUST_10}
        tasks={dayTasks}
        hiddenCount={2}
        projectSlug="KAN"
        onOpenTask={onOpenTask}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: TRIGGER_NAME }));
    fireEvent.click(await screen.findByText("Ship release"));

    expect(onOpenTask).toHaveBeenCalledTimes(1);
    expect(onOpenTask).toHaveBeenCalledWith("t2");
    expect(screen.queryByText("Design review")).toBeNull();
  });

  it("omits the task key when the project slug is unknown", async () => {
    render(
      <DayOverflowPopover
        day={AUGUST_10}
        tasks={dayTasks}
        hiddenCount={2}
        onOpenTask={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: TRIGGER_NAME }));

    expect(await screen.findByText("Design review")).toBeVisible();
    expect(screen.queryByText("KAN-12")).toBeNull();
  });
});

describe("MonthGrid overflow wiring", () => {
  const weeks = buildMonthWeeks(AUGUST_10, 1);

  it("surfaces hidden tasks through the overflow popover", async () => {
    const onOpenTask = vi.fn();

    render(
      <MonthGrid
        weeks={weeks}
        tasks={dayTasks}
        visibleMonth={AUGUST_10}
        maxLanes={1}
        projectSlug="KAN"
        onOpenTask={onOpenTask}
      />,
    );

    // Only one lane fits, so the other two tasks on Aug 10 have to overflow.
    const trigger = screen.getAllByRole("button", { name: TRIGGER_NAME })[0];
    expect(trigger).toBeVisible();

    fireEvent.click(trigger);
    fireEvent.click(await screen.findByText("Ship release"));

    expect(onOpenTask).toHaveBeenCalledWith("t2");
  });

  it("renders no overflow trigger when every task fits", () => {
    render(
      <MonthGrid
        weeks={weeks}
        tasks={dayTasks}
        visibleMonth={AUGUST_10}
        maxLanes={5}
        projectSlug="KAN"
        onOpenTask={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: TRIGGER_NAME })).toBeNull();
  });
});

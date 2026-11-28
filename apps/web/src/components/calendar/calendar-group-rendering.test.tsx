import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import CalendarTaskBar from "./calendar-task-bar";
import MonthAgenda from "./month-agenda";
import DayOverflowPopover from "./day-overflow-popover";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/format", () => ({
  formatDate: () => "August 10",
  formatDateShort: () => "August 10",
}));
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
    <button>{children}</button>
  ),
}));
afterEach(cleanup);

it.each(["grid", "agenda", "overflow"])(
  "renders subtasks inside their parent item in %s",
  (view) => {
    const task = {
      id: "parent",
      title: "Parent",
      number: 1,
      status: "to-do",
      scheduleStart: new Date(2026, 7, 10),
      scheduleEnd: new Date(2026, 7, 10),
      subtasks: [{ id: "child", title: "Child" }],
    };
    const onOpenTask = vi.fn();
    if (view === "grid") {
      render(
        <CalendarTaskBar
          segment={{
            task,
            lane: 0,
            columnStart: 1,
            columnEnd: 2,
            continuesBefore: false,
            continuesAfter: false,
          }}
          onOpenTask={onOpenTask}
        />,
      );
    } else if (view === "agenda") {
      render(
        <MonthAgenda
          tasks={[task]}
          visibleMonth={new Date(2026, 7, 1)}
          onOpenTask={onOpenTask}
        />,
      );
    } else {
      render(
        <DayOverflowPopover
          tasks={[task]}
          day={new Date(2026, 7, 10)}
          hiddenCount={1}
          onOpenTask={onOpenTask}
        />,
      );
    }
    const parentButton = screen.getByText("Parent").closest("button");
    expect(parentButton).toContainElement(screen.getByText("Child"));
    fireEvent.click(screen.getByText("Child"));
    expect(onOpenTask).toHaveBeenCalledWith("parent");
  },
);

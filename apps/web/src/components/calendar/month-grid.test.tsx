import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import MonthGrid from "./month-grid";
import { buildMonthWeeks } from "./month-grid-model";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/format", () => ({
  formatDate: () => "Monday, August 10",
  formatDateShort: (value: Date) => value.toISOString().slice(0, 10),
}));

const AUGUST_10 = new Date(2026, 7, 10);
const AUGUST_12 = new Date(2026, 7, 12);
const weeks = buildMonthWeeks(AUGUST_10, 1);

function renderGrid(onSelectDays?: (from: Date, to: Date) => void) {
  return render(
    <MonthGrid
      weeks={weeks}
      tasks={[]}
      visibleMonth={AUGUST_10}
      maxLanes={3}
      onOpenTask={vi.fn()}
      onSelectDays={onSelectDays}
    />,
  );
}

function dayCell(container: HTMLElement, day: Date) {
  const cell = container.querySelector(
    `[data-calendar-day="${day.getTime()}"]`,
  );
  if (!cell) throw new Error(`No cell for ${day.toDateString()}`);
  return cell;
}

describe("MonthGrid day selection", () => {
  it("selects a single day on click", () => {
    const onSelectDays = vi.fn();
    const { container } = renderGrid(onSelectDays);

    fireEvent.pointerDown(dayCell(container, AUGUST_10), { button: 0 });
    fireEvent.pointerUp(window);

    expect(onSelectDays).toHaveBeenCalledWith(AUGUST_10, AUGUST_10);
  });

  it("selects the range between the pressed and released days", () => {
    const onSelectDays = vi.fn();
    const { container } = renderGrid(onSelectDays);
    const target = dayCell(container, AUGUST_12);
    document.elementsFromPoint = () => [target];

    fireEvent.pointerDown(dayCell(container, AUGUST_10), { button: 0 });
    fireEvent.pointerMove(window);
    fireEvent.pointerUp(window);

    expect(onSelectDays).toHaveBeenCalledWith(AUGUST_10, AUGUST_12);
    Reflect.deleteProperty(document, "elementsFromPoint");
  });

  it("ignores right clicks", () => {
    const onSelectDays = vi.fn();
    const { container } = renderGrid(onSelectDays);

    fireEvent.pointerDown(dayCell(container, AUGUST_10), { button: 2 });
    fireEvent.pointerUp(window);

    expect(onSelectDays).not.toHaveBeenCalled();
  });

  it("selects a day from the keyboard", () => {
    const onSelectDays = vi.fn();
    const { container } = renderGrid(onSelectDays);

    fireEvent.click(dayCell(container, AUGUST_10), { detail: 0 });

    expect(onSelectDays).toHaveBeenCalledWith(AUGUST_10, AUGUST_10);
  });

  it("creates a task from the day's context menu", async () => {
    const onSelectDays = vi.fn();
    const { container } = renderGrid(onSelectDays);

    fireEvent.contextMenu(dayCell(container, AUGUST_10));
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "tasks:calendar.newTask" }),
    );

    expect(onSelectDays).toHaveBeenCalledWith(AUGUST_10, AUGUST_10);
  });

  it("keeps day cells inert without create permission", () => {
    const { container } = renderGrid();

    expect(container.querySelector("[data-calendar-day]")).toBeNull();
  });
});

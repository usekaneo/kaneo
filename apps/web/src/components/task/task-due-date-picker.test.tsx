import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import TaskDueDatePicker from "./task-due-date-picker";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

afterEach(cleanup);

describe("TaskDueDatePicker permissions", () => {
  const props = {
    label: "Due date",
    clearLabel: "Clear date",
    dueDate: new Date("2026-03-10T00:00:00Z"),
    onDateChange: vi.fn(),
    onRecurrenceChange: vi.fn(),
    canSetRecurrence: false,
  };

  it("keeps date editing available without offering to enable recurrence", () => {
    render(<TaskDueDatePicker {...props} recurrence={null} />);
    expect(screen.getByText("Clear date")).toBeInTheDocument();
    expect(
      screen.queryByText("tasks:popover.recurrence.toggle"),
    ).not.toBeInTheDocument();
  });

  it("allows stopping a series without offering rule edits", () => {
    const onRecurrenceChange = vi.fn();
    render(
      <TaskDueDatePicker
        {...props}
        onRecurrenceChange={onRecurrenceChange}
        recurrence={{ frequency: "weekly", interval: 1, timeZone: "UTC" }}
      />,
    );
    expect(
      screen.queryByRole("combobox", {
        name: "tasks:popover.recurrence.repeats",
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:popover.recurrence.toggle" }),
    );
    expect(onRecurrenceChange).toHaveBeenCalledWith(null);
  });
});

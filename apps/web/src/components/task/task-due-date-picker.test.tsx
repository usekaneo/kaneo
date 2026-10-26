import { TZDate } from "@date-fns/tz";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import TaskDueDatePicker from "./task-due-date-picker";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
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

  it("selects the implicit weekday in the rule's time zone", () => {
    const onRecurrenceChange = vi.fn();
    render(
      <TaskDueDatePicker
        {...props}
        canSetRecurrence
        dueDate={new TZDate("2026-03-08T10:30:00Z", "UTC")}
        recurrence={{
          frequency: "weekly",
          interval: 1,
          timeZone: "Pacific/Kiritimati",
        }}
        onRecurrenceChange={onRecurrenceChange}
      />,
    );
    expect(screen.getByRole("button", { name: "Monday" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Sunday" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    fireEvent.click(screen.getByRole("button", { name: "Thursday" }));
    expect(onRecurrenceChange).toHaveBeenCalledWith(
      expect.objectContaining({ weekdays: [1, 4] }),
    );
  });

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

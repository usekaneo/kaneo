import { describe, expect, it } from "vite-plus/test";
import { getLocalizedDeliveryContent } from "./delivery-copy";

describe("getLocalizedDeliveryContent", () => {
  it("uses the recipient's locale", () => {
    expect(
      getLocalizedDeliveryContent(
        "task_assignee_changed",
        { taskTitle: "Fix login" },
        "de-DE",
      ),
    ).toEqual({
      title: "Aufgabe wurde dir zugewiesen",
      body: 'Dir wurde die Aufgabe "Fix login" zugewiesen',
    });
  });

  it("falls back to English for a missing or unknown locale", () => {
    expect(
      getLocalizedDeliveryContent("task_overdue", { taskTitle: "A" }, null),
    ).toEqual({ title: "Task overdue", body: "A is past its due date" });
    expect(
      getLocalizedDeliveryContent("task_overdue", { taskTitle: "A" }, "xx"),
    ).toEqual({ title: "Task overdue", body: "A is past its due date" });
  });

  it("matches a language-only locale", () => {
    expect(
      getLocalizedDeliveryContent("task_overdue", { taskTitle: "A" }, "de")
        ?.title,
    ).toBe(
      getLocalizedDeliveryContent("task_overdue", { taskTitle: "A" }, "de-DE")
        ?.title,
    );
  });

  it("localizes status labels and reminder lead time", () => {
    expect(
      getLocalizedDeliveryContent(
        "task_status_changed",
        { taskTitle: "A", oldStatus: "to-do", newStatus: "custom_col" },
        "en-US",
      )?.body,
    ).toBe('Task "A" status changed from "To Do" to "Custom Col"');
    expect(
      getLocalizedDeliveryContent(
        "due_date_reminder",
        { taskTitle: "A", leadTimeMinutes: 120 },
        "en-US",
      )?.body,
    ).toBe("A is due in 2 hours");
  });

  it("picks the time entry body by whether a task is known", () => {
    expect(
      getLocalizedDeliveryContent("time_entry_created", {}, "en-US")?.body,
    ).toBe("Time tracking started on a task");
  });

  it("uses the locale's plural forms for the reminder lead time", () => {
    const body = (minutes: number) =>
      getLocalizedDeliveryContent(
        "due_date_reminder",
        { taskTitle: "A", leadTimeMinutes: minutes },
        "ru-RU",
      )?.body;
    expect(body(60)).toMatch(/ 1 час$/);
    expect(body(120)).toMatch(/ 2 часа$/);
    expect(body(300)).toMatch(/ 5 часов$/);
  });

  it("returns null when a placeholder value is missing", () => {
    expect(
      getLocalizedDeliveryContent(
        "task_mention",
        { mentionerName: null, taskTitle: "A" },
        "de-DE",
      ),
    ).toBeNull();
  });

  it("returns null for types without copy", () => {
    expect(getLocalizedDeliveryContent("custom", {}, "en-US")).toBeNull();
  });
});

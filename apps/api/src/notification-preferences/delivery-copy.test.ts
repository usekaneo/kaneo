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

  it.each([null, undefined, "", "   "])(
    "localizes an unnamed mention author (%j)",
    (mentionerName) => {
      expect(
        getLocalizedDeliveryContent(
          "task_mention",
          { mentionerName, taskTitle: "A" },
          "de-DE",
        ),
      ).toEqual({
        title: "Jemand hat dich erwähnt",
        body: "Jemand hat dich in „A“ erwähnt",
      });
    },
  );

  it("preserves named authors and uses the recipient's anonymous label", () => {
    expect(
      getLocalizedDeliveryContent(
        "task_mention",
        { mentionerName: "Ada", taskTitle: "A" },
        "de-DE",
      )?.title,
    ).toBe("Ada hat dich erwähnt");
    expect(
      getLocalizedDeliveryContent("task_mention", { taskTitle: "A" }, "ja-JP")
        ?.title,
    ).toBe("ユーザー さんがあなたをメンションしました");
    expect(
      getLocalizedDeliveryContent("task_mention", { taskTitle: "A" }, "xx")
        ?.title,
    ).toBe("Someone mentioned you");
  });

  it("returns null when another required placeholder is missing", () => {
    expect(
      getLocalizedDeliveryContent(
        "task_mention",
        { mentionerName: "Ada", taskTitle: null },
        "de-DE",
      ),
    ).toBeNull();
  });

  it("returns null for types without copy", () => {
    expect(getLocalizedDeliveryContent("custom", {}, "en-US")).toBeNull();
    expect(
      getLocalizedDeliveryContent("constructor", { taskTitle: "A" }, "en-US"),
    ).toBeNull();
  });

  it("treats a column slug named like an object key as a custom column", () => {
    expect(
      getLocalizedDeliveryContent(
        "task_status_changed",
        { taskTitle: "A", oldStatus: "to-do", newStatus: "constructor" },
        "en-US",
      )?.body,
    ).toBe('Task "A" status changed from "To Do" to "Constructor"');
  });
});

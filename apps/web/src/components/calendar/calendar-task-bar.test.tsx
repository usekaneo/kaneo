import enUS from "@i18n/en-US.json";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CalendarTaskBar from "./calendar-task-bar";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

// Formats from local parts, so the expected label does not move with the
// runner's timezone the way toISOString would.
vi.mock("@/lib/format", () => ({
  formatDateShort: (value: Date) =>
    [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0"),
    ].join("-"),
}));

/**
 * Resolves against the real en-US bundle and applies i18next-style
 * interpolation, so the assertions fail if the key stops passing a value the
 * source string expects.
 */
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const [namespace, path] = key.split(":");
      const source = path
        .split(".")
        .reduce<unknown>(
          (accumulator, part) =>
            (accumulator as Record<string, unknown> | undefined)?.[part],
          (enUS as Record<string, unknown>)[namespace],
        );

      if (typeof source !== "string") return key;

      return source.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
        String(options?.[name] ?? `{{${name}}}`),
      );
    },
  }),
}));

const segment = {
  task: {
    id: "t1",
    title: "Design review",
    number: 12,
    status: "in-review",
    scheduleStart: new Date(2026, 7, 10),
    scheduleEnd: new Date(2026, 7, 12),
  },
  lane: 0,
  columnStart: 1,
  columnEnd: 4,
  continuesBefore: false,
  continuesAfter: false,
};

describe("CalendarTaskBar", () => {
  it("announces the task title and its scheduled range", () => {
    render(
      <CalendarTaskBar
        segment={segment}
        projectSlug="KAN"
        onOpenTask={vi.fn()}
      />,
    );

    expect(screen.getByRole("button")).toHaveAccessibleName(
      "Design review, 2026-08-10 – 2026-08-12: open task",
    );
  });

  it("leaves no interpolation placeholder unresolved", () => {
    render(
      <CalendarTaskBar
        segment={segment}
        projectSlug="KAN"
        onOpenTask={vi.fn()}
      />,
    );

    const label = screen.getByRole("button").getAttribute("aria-label") ?? "";

    expect(label).not.toMatch(/\{\{\w+\}\}/);
  });

  it.each([
    ["to-do", "bg-slate-500/15"],
    ["in-progress", "bg-blue-500/15"],
    ["in-review", "bg-amber-500/15"],
    ["done", "bg-emerald-500/15"],
    ["custom-status", "bg-primary/12"],
  ])("uses the %s status color", (status, expectedClass) => {
    render(
      <CalendarTaskBar
        segment={{
          ...segment,
          task: { ...segment.task, status },
        }}
        projectSlug="KAN"
        onOpenTask={vi.fn()}
      />,
    );

    const taskBar = screen.getByRole("button");
    expect(taskBar).toHaveAttribute("data-task-status", status);
    expect(taskBar).toHaveClass(expectedClass);
  });
});

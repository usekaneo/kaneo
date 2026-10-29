import { cleanup, render, screen } from "@testing-library/react";
import { addDays, parseISO } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { GanttTaskBar } from "./gantt-task-bar.js";
import type { ScheduledTask } from "./scheduled-task.js";

vi.mock("@kaneo/plugin-sdk/web", () => ({
  useT: () => (key: string) => key,
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
  useUpdateTask: () => vi.fn(),
}));

const rangeStart = parseISO("2026-09-01");
const timeline = {
  rangeStart,
  days: Array.from({ length: 10 }, (_, index) => addDays(rangeStart, index)),
  gridTemplateColumns: "repeat(10, 44px)",
};

function scheduledTask(start: string, end: string): ScheduledTask {
  return {
    id: "task-1",
    projectId: "project",
    title: "Short task",
    number: 1,
    description: null,
    status: "to-do",
    priority: null,
    startDate: start,
    dueDate: end,
    assigneeId: null,
    assigneeName: null,
    scheduleStart: parseISO(start),
    scheduleEnd: parseISO(end),
  };
}

function renderBar(task: ScheduledTask, isMobile: boolean) {
  return render(
    <GanttTaskBar
      task={task}
      timeline={timeline}
      pixelsPerDay={44}
      isMobile={isMobile}
      onOpenTask={vi.fn()}
    />,
  );
}

afterEach(cleanup);

describe("GanttTaskBar", () => {
  it("draws a short phone bar's title beside it without resize handles", () => {
    const { container } = renderBar(
      scheduledTask("2026-09-02", "2026-09-03"),
      true,
    );

    expect(screen.queryByRole("button", { name: "resizeStart" })).toBeNull();
    expect(screen.queryByRole("button", { name: "resizeDue" })).toBeNull();
    const inside = screen
      .getByRole("button", { name: "taskAriaLabel" })
      .querySelector("span");
    expect(inside?.className).toContain("gantt:sr-only");
    const beside = container.querySelector<HTMLElement>(
      'span[aria-hidden="true"]',
    );
    expect(beside?.textContent).toBe("Short task");
    expect(beside?.style.gridColumn).toBe("4 / 11");
  });

  it("keeps the title inside a short phone bar that reaches the end of the timeline", () => {
    const { container } = renderBar(
      scheduledTask("2026-09-09", "2026-09-10"),
      true,
    );

    expect(container.querySelector('span[aria-hidden="true"]')).toBeNull();
    const inside = screen
      .getByRole("button", { name: "taskAriaLabel" })
      .querySelector("span");
    expect(inside?.className).not.toContain("gantt:sr-only");
  });

  it("keeps resize handles and the inline title on wide phone bars and on desktop", () => {
    renderBar(scheduledTask("2026-09-02", "2026-09-05"), true);
    expect(screen.getByRole("button", { name: "resizeStart" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "resizeDue" })).toBeTruthy();
    cleanup();

    const { container } = renderBar(
      scheduledTask("2026-09-02", "2026-09-02"),
      false,
    );
    expect(screen.getByRole("button", { name: "resizeStart" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "resizeDue" })).toBeTruthy();
    expect(container.querySelector('span[aria-hidden="true"]')).toBeNull();
  });
});

import type { ButtonProps } from "@kaneo/plugin-sdk/ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { GanttToolbar } from "./gantt-toolbar.js";

vi.mock("@kaneo/plugin-sdk/web", () => ({
  useT: () => (key: string) => key,
}));

vi.mock("@kaneo/plugin-sdk/ui", () => ({
  Button: ({ variant: _variant, size: _size, ...props }: ButtonProps) => (
    <button type="button" {...props} />
  ),
}));

function renderToolbar(showTaskRail: boolean) {
  const onJumpToToday = vi.fn();
  const onToggleTaskRail = vi.fn();
  render(
    <GanttToolbar
      timeline={null}
      onShowDate={vi.fn()}
      canJumpToToday
      onJumpToToday={onJumpToToday}
      showTaskRail={showTaskRail}
      onToggleTaskRail={onToggleTaskRail}
    />,
  );
  return { onJumpToToday, onToggleTaskRail };
}

afterEach(cleanup);

describe("GanttToolbar", () => {
  it("leaves search to Kaneo's toolbar and names the view for screen readers", () => {
    renderToolbar(true);

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(
      screen.getByRole("heading", { level: 1, name: "title" }).className,
    ).toBe("gantt:sr-only");
  });

  it("keeps the jump-to-today button labeled when its text is hidden on phones", () => {
    const { onJumpToToday } = renderToolbar(true);

    const button = screen.getByRole("button", { name: "jumpToToday" });
    expect(button.querySelector("span")?.className).toBe(
      "gantt:hidden gantt:sm:inline",
    );
    fireEvent.click(button);
    expect(onJumpToToday).toHaveBeenCalledTimes(1);
  });

  it("reports whether the task rail is shown on its toggle", () => {
    const { onToggleTaskRail } = renderToolbar(false);

    const toggle = screen.getByRole("button", { name: "showTasks" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(onToggleTaskRail).toHaveBeenCalledTimes(1);

    cleanup();
    renderToolbar(true);
    expect(
      screen
        .getByRole("button", { name: "hideTasks" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
});

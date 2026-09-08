import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TaskProgressBadges } from "./task-progress-badges";

const preferences = vi.hoisted(() => ({ showTaskItemCounts: true }));
vi.mock("@/store/user-preferences", () => ({
  useUserPreferencesStore: () => preferences,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values: { completed: number; total: number }) =>
      `${values.completed} of ${values.total} ${key.includes("subtasks") ? "subtasks" : "checklist items"} completed`,
  }),
}));

afterEach(cleanup);

beforeEach(() => {
  preferences.showTaskItemCounts = true;
});

describe("TaskProgressBadges", () => {
  it("keeps checklist and subtask completion independent", () => {
    render(
      <TaskProgressBadges
        task={{
          description: "- [x] One\n- [ ] Two\n- [ ] Three",
          subtaskCounts: { completed: 2, total: 2 },
        }}
      />,
    );
    const subtasks = screen.getByRole("button", {
      name: "2 of 2 subtasks completed",
    });
    const checklist = screen.getByRole("button", {
      name: "1 of 3 checklist items completed",
    });
    expect(subtasks).toHaveTextContent("2/2");
    expect(subtasks).toHaveClass("text-success-foreground");
    expect(checklist).toHaveTextContent("1/3");
    expect(checklist).not.toHaveClass("text-success-foreground");
  });

  it("shows subtasks when description checklist counts are disabled", () => {
    preferences.showTaskItemCounts = false;
    render(
      <TaskProgressBadges
        task={{
          description: "- [ ] One",
          subtaskCounts: { completed: 0, total: 3 },
        }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "0 of 3 subtasks completed" }),
    ).toBeVisible();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("hides absent and empty counters", () => {
    const { rerender } = render(
      <TaskProgressBadges task={{ description: null }} />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(
      <TaskProgressBadges
        task={{
          description: "Plain text",
          subtaskCounts: { completed: 0, total: 0 },
        }}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("provides a tooltip and preserves the card's open action", async () => {
    const open = vi.fn();
    render(
      <TooltipProvider delay={0}>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: reproduces the task card click boundary */}
        <div onClick={open} role="presentation">
          <TaskProgressBadges
            task={{
              description: null,
              subtaskCounts: { completed: 2, total: 5 },
            }}
          />
        </div>
      </TooltipProvider>,
    );
    const badge = screen.getByRole("button", {
      name: "2 of 5 subtasks completed",
    });
    fireEvent.mouseEnter(badge);
    expect(await screen.findByText("2 of 5 subtasks completed")).toBeVisible();
    fireEvent.click(badge);
    expect(open).toHaveBeenCalledOnce();
  });
});

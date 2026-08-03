import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResolvedSavedView } from "@/types/saved-view";
import MobileProjectNav from "./mobile-project-nav";

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/queries/project/use-get-projects", () => ({
  default: () => ({ data: [] }),
}));

const views: ResolvedSavedView[] = [
  {
    key: "planning",
    name: "Planning",
    type: "list",
    position: 0,
    enabled: true,
    configuration: {},
  },
  {
    key: "delivery",
    name: "Delivery",
    type: "board",
    position: 1,
    enabled: true,
    configuration: {},
  },
  {
    key: "timeline",
    name: "Timeline",
    type: "gantt",
    position: 2,
    enabled: false,
    configuration: {},
  },
];

afterEach(cleanup);

describe("MobileProjectNav", () => {
  it("renders configured enabled views and keeps existing callbacks", () => {
    const onSelectBacklog = vi.fn();
    const onSelectBoard = vi.fn();

    render(
      <MobileProjectNav
        workspaceId="workspace-1"
        projectId="project-1"
        activeView="board"
        views={views}
        onSelectBacklog={onSelectBacklog}
        onSelectBoard={onSelectBoard}
        onSelectGantt={vi.fn()}
        onSelectProject={vi.fn()}
        onAddProject={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Planning" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Delivery" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByRole("button", { name: "Timeline" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Planning" }));
    fireEvent.click(screen.getByRole("button", { name: "Delivery" }));
    expect(onSelectBacklog).toHaveBeenCalledOnce();
    expect(onSelectBoard).toHaveBeenCalledOnce();
  });

  it("contains long configured view names", () => {
    const longName = "Delivery work currently in progress";
    render(
      <MobileProjectNav
        workspaceId="workspace-1"
        projectId="project-1"
        activeView="board"
        views={[{ ...views[1], name: longName }]}
        onSelectBacklog={vi.fn()}
        onSelectBoard={vi.fn()}
        onSelectGantt={vi.fn()}
        onSelectProject={vi.fn()}
        onAddProject={vi.fn()}
      />,
    );

    const label = screen.getByText(longName);
    expect(label).toHaveClass("max-w-full", "truncate");
    expect(label).toHaveAttribute("title", longName);
  });
});

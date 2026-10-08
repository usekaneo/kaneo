import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { useState } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import TaskViewContextMenu from "./task-view-context-menu";

let canCreate = true;
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canCreateTasks: () => canCreate }),
}));
vi.mock("@/components/shared/modals/create-task-modal", () => ({
  default: ({ projectId, status }: { projectId: string; status?: string }) => (
    <div data-testid="creation" data-project={projectId} data-status={status} />
  ),
}));
afterEach(() => {
  cleanup();
  canCreate = true;
});

it("creates in the clicked column and resets to the project default outside columns", async () => {
  render(
    <TaskViewContextMenu projectId="project">
      <div data-testid="background">
        <div data-task-status="in-progress">
          <span>Empty column</span>
        </div>
      </div>
    </TaskViewContextMenu>,
  );
  fireEvent.contextMenu(screen.getByText("Empty column"));
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "tasks:calendar.newTask" }),
  );
  expect(screen.getByTestId("creation")).toHaveAttribute(
    "data-status",
    "in-progress",
  );
  expect(screen.getByTestId("creation")).toHaveAttribute(
    "data-project",
    "project",
  );
  fireEvent.contextMenu(screen.getByTestId("background"));
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "tasks:calendar.newTask" }),
  );
  expect(screen.getByTestId("creation")).not.toHaveAttribute("data-status");
});

it("lets a nested task context menu handle right clicks instead of the background menu", async () => {
  render(
    <TaskViewContextMenu projectId="project">
      <div>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div>Task card</div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem>Task action</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    </TaskViewContextMenu>,
  );
  fireEvent.contextMenu(screen.getByText("Task card"));
  expect(
    await screen.findByRole("menuitem", { name: "Task action" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("menuitem", { name: "tasks:calendar.newTask" }),
  ).not.toBeInTheDocument();
});

it.each([false, true])(
  "does not offer creation without permission or when disabled (%s)",
  (disabled) => {
    canCreate = disabled;
    render(
      <TaskViewContextMenu projectId="project" disabled={disabled}>
        <div>Background</div>
      </TaskViewContextMenu>,
    );

    fireEvent.contextMenu(screen.getByText("Background"));
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
  },
);

it("keeps child drafts and the creation dialog mounted while refreshing", async () => {
  function ChildDraft() {
    const [title, setTitle] = useState("");
    return (
      <input
        aria-label="Child draft"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
    );
  }
  const renderView = (disabled: boolean) => (
    <TaskViewContextMenu projectId="project" disabled={disabled}>
      <div>
        <span>Background</span>
        <ChildDraft />
      </div>
    </TaskViewContextMenu>
  );
  const view = render(renderView(false));
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Keep this draft" },
  });
  fireEvent.contextMenu(screen.getByText("Background"));
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "tasks:calendar.newTask" }),
  );
  const creation = screen.getByTestId("creation");
  for (const disabled of [true, false]) {
    view.rerender(renderView(disabled));
    expect(screen.getByRole("textbox")).toHaveValue("Keep this draft");
    expect(screen.getByTestId("creation")).toBe(creation);
  }
});

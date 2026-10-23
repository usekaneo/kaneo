import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import type Task from "@/types/task";
import { TaskCardBreadcrumbs } from "./task-card-breadcrumbs";
const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
const task = {
  id: "grandchild",
  projectId: "project",
  ancestors: [
    { id: "child", title: "Child", projectId: "project" },
    { id: "parent", title: "Parent", projectId: "another" },
  ],
} as Task;
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("shows the task ID then ancestors from nearest to furthest", () => {
  render(<TaskCardBreadcrumbs task={task} workspaceId="w" ticketId="VIC-8" />);
  const list = screen.getByRole("list");
  expect(
    within(list)
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toEqual(["VIC-8", "Child", "Parent"]);
});
it("opens a same-project parent without opening the child or starting a drag", () => {
  const cardClick = vi.fn();
  const startDrag = vi.fn();
  render(
    <div
      role="button"
      tabIndex={0}
      onKeyDown={cardClick}
      onClick={cardClick}
      onMouseDown={startDrag}
      onTouchStart={startDrag}
    >
      <TaskCardBreadcrumbs task={task} workspaceId="w" ticketId="VIC-8" />
    </div>,
  );
  const parent = screen.getByRole("button", { name: "Child" });
  fireEvent.mouseDown(parent);
  fireEvent.touchStart(parent);
  fireEvent.click(parent);
  expect(navigate).toHaveBeenCalledWith({
    to: ".",
    search: { taskId: "child" },
  });
  expect(cardClick).not.toHaveBeenCalled();
  expect(startDrag).not.toHaveBeenCalled();
});
it("opens cross-project ancestors in the correct workspace and project", () => {
  render(<TaskCardBreadcrumbs task={task} workspaceId="w" />);
  fireEvent.click(screen.getByRole("button", { name: "Parent" }));
  expect(navigate).toHaveBeenCalledWith({
    to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
    params: { workspaceId: "w", projectId: "another", taskId: "parent" },
  });
});
it("keeps ancestry visible when task numbers are hidden", () => {
  render(<TaskCardBreadcrumbs task={task} workspaceId="w" />);
  expect(
    screen.getAllByRole("listitem").map((item) => item.textContent),
  ).toEqual(["Child", "Parent"]);
});
it("keeps long ancestor titles available and buttons keyboard-focusable", () => {
  const title =
    "A very long parent title that needs truncation on a narrow card";
  render(
    <TaskCardBreadcrumbs
      task={{
        ...task,
        ancestors: [{ id: "long", projectId: "project", title }],
      }}
      workspaceId="w"
    />,
  );
  const button = screen.getByRole("button", { name: title });
  expect(button).toHaveAttribute("title", title);
  expect(button).toHaveClass("truncate");
  button.focus();
  expect(button).toHaveFocus();
});
it("renders neither separators nor empty navigation when there is no ancestry or ID", () => {
  render(
    <TaskCardBreadcrumbs task={{ ...task, ancestors: [] }} workspaceId="w" />,
  );
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
});

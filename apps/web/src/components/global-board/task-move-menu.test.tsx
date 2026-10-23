import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { GlobalBoardTask } from "@/fetchers/task/get-global-board-tasks";
import { TaskMoveMenu } from "./task-move-menu";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

afterEach(cleanup);

const task = {
  id: "t1",
  title: "Walk cycle",
  status: "to-do",
  projectName: "Animation",
} as GlobalBoardTask;

const columns = [
  { slug: "to-do", name: "To Do", isFinal: false, icon: null, position: 0 },
  { slug: "done", name: "Done", isFinal: true, icon: null, position: 1 },
] as Parameters<typeof TaskMoveMenu>[0]["columns"];

function open() {
  fireEvent.click(screen.getByRole("button"));
}

describe("TaskMoveMenu", () => {
  it("moves a card to the top, to a column, or to the backlog", async () => {
    const onMoveToTop = vi.fn();
    const onMove = vi.fn();
    const onMoveToBacklog = vi.fn();
    render(
      <TaskMoveMenu
        task={task}
        columns={columns}
        onMove={onMove}
        onMoveToTop={onMoveToTop}
        onMoveToBacklog={onMoveToBacklog}
      />,
    );

    open();
    fireEvent.click(await screen.findByText("tasks:globalBoard.moveToTop"));
    expect(onMoveToTop).toHaveBeenCalledOnce();

    open();
    fireEvent.click(await screen.findByText("Done"));
    expect(onMove).toHaveBeenCalledWith(columns[1]);

    open();
    fireEvent.click(await screen.findByText("tasks:actions.moveToBacklog"));
    expect(onMoveToBacklog).toHaveBeenCalledOnce();
  });

  it("offers only arranging to people who cannot move tasks", async () => {
    render(<TaskMoveMenu task={task} columns={[]} onMove={vi.fn()} />);
    open();
    const top = await screen.findByRole("menuitem", {
      name: "tasks:globalBoard.moveToTop",
    });
    expect(top).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByText("Done")).toBeNull();
    expect(screen.queryByText("tasks:actions.moveToBacklog")).toBeNull();
  });
});

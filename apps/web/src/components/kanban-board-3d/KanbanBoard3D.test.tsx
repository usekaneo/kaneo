import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectWithTasks } from "@/types/project";
import KanbanBoard3D from "./KanbanBoard3D";

const navigateMock = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function makeTask(id: string, title: string, number: number) {
  return {
    id,
    title,
    number,
    description: null,
    status: "to-do",
    priority: "medium",
    startDate: null,
    dueDate: null,
    position: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    userId: null,
    assigneeId: null,
    assigneeName: "Alex",
    projectId: "p1",
  };
}

const project = {
  id: "p1",
  name: "Demo",
  columns: [
    {
      id: "col-todo",
      name: "To do",
      tasks: [makeTask("t1", "Ship 3D view", 1), makeTask("t2", "Fix bug", 2)],
    },
    {
      id: "col-done",
      name: "Done",
      tasks: [],
    },
  ],
} as unknown as ProjectWithTasks;

function getViewport(container: HTMLElement) {
  const viewport = container.querySelector("[data-board3d-viewport]");
  if (!(viewport instanceof HTMLElement)) throw new Error("no viewport");
  return viewport;
}

function getWorld(container: HTMLElement) {
  const world = container.querySelector("[data-board3d-world]");
  if (!(world instanceof HTMLElement)) throw new Error("no world");
  return world;
}

function pointer(
  type: string,
  init: MouseEventInit & { clientX?: number; clientY?: number },
) {
  return new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
}

describe("KanbanBoard3D", () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders every column with its task count", () => {
    render(<KanbanBoard3D project={project} />);

    expect(screen.getByText("To do")).toBeVisible();
    expect(screen.getByText("Done")).toBeVisible();
    expect(screen.getByText("2")).toBeVisible();
    expect(screen.getByText("Ship 3D view")).toBeVisible();
    expect(screen.getByText("Fix bug")).toBeVisible();
    expect(screen.getByText("#1")).toBeVisible();
    expect(screen.getAllByText("Alex")).toHaveLength(2);
  });

  it("applies the default camera transform to the world", () => {
    const { container } = render(<KanbanBoard3D project={project} />);
    const world = getWorld(container);

    expect(world.style.transform).toContain("rotateX(12deg)");
    expect(world.style.transform).toContain("rotateY(-18deg)");
    expect(world.style.transform).toContain("translate3d(0px, 0px, -1200px)");
  });

  it("positions columns in 3D space", () => {
    const { container } = render(<KanbanBoard3D project={project} />);
    const columns = container.querySelectorAll(
      "[data-board3d-world] > div > div",
    );

    expect(columns).toHaveLength(2);
    const first = columns[0] as HTMLElement;
    const second = columns[1] as HTMLElement;
    expect(first.style.transform).toContain("translate3d(-330px");
    expect(second.style.transform).toContain("translate3d(30px");
    expect(first.style.transform).toContain("rotateY(3deg)");
    expect(second.style.transform).toContain("rotateY(-3deg)");
  });

  it("opens a task via the taskId search param when a card is clicked", () => {
    render(<KanbanBoard3D project={project} />);

    fireEvent.click(screen.getByText("Ship 3D view"));

    expect(navigateMock).toHaveBeenCalledWith({
      to: ".",
      search: { taskId: "t1" },
      replace: true,
    });
  });

  it("zooms with the mouse wheel", () => {
    const { container } = render(<KanbanBoard3D project={project} />);
    const viewport = getViewport(container);
    const world = getWorld(container);

    viewport.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: -100,
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(world.style.transform).toContain("-1400px");
  });

  it("clamps the zoom range", () => {
    const { container } = render(<KanbanBoard3D project={project} />);
    const viewport = getViewport(container);
    const world = getWorld(container);

    viewport.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: -100000,
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(world.style.transform).toContain("-10000px");
  });

  it("pans the camera with a plain drag", () => {
    const { container } = render(<KanbanBoard3D project={project} />);
    const viewport = getViewport(container);
    const world = getWorld(container);

    viewport.dispatchEvent(
      pointer("pointerdown", { button: 0, clientX: 100, clientY: 100 }),
    );
    viewport.dispatchEvent(
      pointer("pointermove", { clientX: 110, clientY: 130 }),
    );
    viewport.dispatchEvent(pointer("pointerup", {}));

    expect(world.style.transform).toContain("translate3d(10px, 30px, -1200px)");
  });

  it("rotates the camera with ctrl-drag and clamps the tilt", () => {
    const { container } = render(<KanbanBoard3D project={project} />);
    const viewport = getViewport(container);
    const world = getWorld(container);

    viewport.dispatchEvent(
      pointer("pointerdown", {
        button: 0,
        ctrlKey: true,
        clientX: 100,
        clientY: 100,
      }),
    );
    viewport.dispatchEvent(
      pointer("pointermove", { clientX: 120, clientY: 100 }),
    );

    expect(world.style.transform).toContain("rotateY(-12deg)");

    viewport.dispatchEvent(
      pointer("pointermove", { clientX: 120, clientY: -100000 }),
    );
    viewport.dispatchEvent(pointer("pointerup", {}));

    expect(world.style.transform).toContain("rotateX(80deg)");
  });

  it("stops reacting to movement after the drag ends", () => {
    const { container } = render(<KanbanBoard3D project={project} />);
    const viewport = getViewport(container);
    const world = getWorld(container);

    viewport.dispatchEvent(
      pointer("pointerdown", { button: 0, clientX: 0, clientY: 0 }),
    );
    viewport.dispatchEvent(pointer("pointerup", {}));
    viewport.dispatchEvent(
      pointer("pointermove", { clientX: 50, clientY: 50 }),
    );

    expect(world.style.transform).toContain("translate3d(0px, 0px, -1200px)");
  });

  it("does not start a drag from a task card, so clicks stay clicks", () => {
    const { container } = render(<KanbanBoard3D project={project} />);
    const world = getWorld(container);
    const card = screen.getByText("Ship 3D view");

    card.dispatchEvent(
      pointer("pointerdown", { button: 0, clientX: 0, clientY: 0 }),
    );
    card.dispatchEvent(pointer("pointermove", { clientX: 40, clientY: 40 }));

    expect(world.style.transform).toContain("translate3d(0px, 0px, -1200px)");
  });

  it("lets the wheel scroll an overflowing task list instead of zooming", () => {
    const { container } = render(<KanbanBoard3D project={project} />);
    const world = getWorld(container);
    const list = container.querySelector("[data-board3d-scroll]");
    if (!(list instanceof HTMLElement)) throw new Error("no list");
    Object.defineProperty(list, "scrollHeight", { value: 500 });
    Object.defineProperty(list, "clientHeight", { value: 100 });
    list.scrollTop = 0;

    list.dispatchEvent(
      new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true }),
    );

    expect(world.style.transform).toContain("-1200px");
  });

  it("zooms once the overflowing list is at the edge of its scroll range", () => {
    const { container } = render(<KanbanBoard3D project={project} />);
    const world = getWorld(container);
    const list = container.querySelector("[data-board3d-scroll]");
    if (!(list instanceof HTMLElement)) throw new Error("no list");
    Object.defineProperty(list, "scrollHeight", { value: 500 });
    Object.defineProperty(list, "clientHeight", { value: 100 });
    list.scrollTop = 400;

    list.dispatchEvent(
      new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true }),
    );

    expect(world.style.transform).toContain("-1000px");
  });

  it("resets the camera with the reset button", () => {
    const { container } = render(<KanbanBoard3D project={project} />);
    const viewport = getViewport(container);
    const world = getWorld(container);

    viewport.dispatchEvent(
      new WheelEvent("wheel", { deltaY: 500, bubbles: true, cancelable: true }),
    );
    expect(world.style.transform).not.toContain("-1200px");

    fireEvent.click(screen.getByRole("button", { name: /reset/i }));

    expect(world.style.transform).toContain("translate3d(0px, 0px, -1200px)");
    expect(world.style.transform).toContain("rotateX(12deg)");
  });
});

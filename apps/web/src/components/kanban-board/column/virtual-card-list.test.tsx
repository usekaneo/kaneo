import { cleanup, render } from "@testing-library/react";
import { useState } from "react";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vite-plus/test";
import type { ProjectWithTasks } from "@/types/project";
import { VirtualCardList } from "./virtual-card-list";

vi.mock("../task-card", () => ({
  default: ({ task }: { task: { id: string } }) => (
    <div data-task-id={task.id} />
  ),
}));

afterEach(cleanup);

const stubs = [
  [Element.prototype, "clientHeight", 400],
  [Element.prototype, "clientWidth", 300],
  [HTMLElement.prototype, "offsetHeight", 92],
] as const;
const originals = stubs.map(([target, key]) =>
  Object.getOwnPropertyDescriptor(target, key),
);

beforeAll(() => {
  for (const [target, key, value] of stubs)
    Object.defineProperty(target, key, {
      configurable: true,
      get: () => value,
    });
});

afterAll(() => {
  stubs.forEach(([target, key], index) => {
    const original = originals[index];
    if (original) Object.defineProperty(target, key, original);
  });
});

function column(count: number) {
  return {
    id: "done",
    slug: "done",
    isFinal: true,
    tasks: Array.from({ length: count }, (_, index) => ({ id: `t${index}` })),
  } as unknown as ProjectWithTasks["columns"][number];
}

function List({ activeTaskId }: { activeTaskId: string | null }) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setElement}>
      <VirtualCardList
        column={column(300)}
        activeTaskId={activeTaskId}
        disableDragDrop={false}
        scrollElement={element}
      />
    </div>
  );
}

function renderList(activeTaskId: string | null) {
  const { container } = render(<List activeTaskId={activeTaskId} />);
  return [...container.querySelectorAll("[data-task-id]")].map((element) =>
    element.getAttribute("data-task-id"),
  );
}

it("mounts only a window of a long column", () => {
  const rendered = renderList(null);
  expect(rendered.length).toBeGreaterThan(0);
  expect(rendered.length).toBeLessThan(300);
});

it("keeps the dragged card mounted outside the window", () => {
  expect(renderList(null)).not.toContain("t250");
  expect(renderList("t250")).toContain("t250");
});

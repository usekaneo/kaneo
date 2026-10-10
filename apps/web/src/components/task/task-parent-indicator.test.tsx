import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import TaskParentIndicator from "./task-parent-indicator";
import { TooltipProvider } from "@/components/ui/tooltip";
const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, { title }: { title: string }) => `Sub-task of ${title}`,
  }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("opens the selected parent in its project's sheet without opening or dragging the child", async () => {
  const click = vi.fn();
  const pointerDown = vi.fn();
  const keyDown = vi.fn();
  render(
    <TooltipProvider delay={0}>
      <div
        onClick={click}
        onPointerDown={pointerDown}
        onKeyDown={keyDown}
        role="presentation"
      >
        <TaskParentIndicator
          workspaceId="workspace"
          parents={[
            { id: "a", title: "Parent A", projectId: "project-a" },
            { id: "b", title: "Parent B", projectId: "project-b" },
          ]}
        />
      </div>
    </TooltipProvider>,
  );
  const trigger = screen.getByRole("button", {
    name: "Sub-task of Parent A",
  });
  fireEvent.mouseEnter(trigger);
  expect(await screen.findByText("Sub-task of Parent A")).toBeInTheDocument();
  fireEvent.pointerDown(trigger);
  fireEvent.keyDown(trigger, { key: "Enter" });
  fireEvent.click(trigger);
  expect(click).not.toHaveBeenCalled();
  expect(pointerDown).not.toHaveBeenCalled();
  expect(keyDown).not.toHaveBeenCalled();
  expect(navigate).toHaveBeenCalledWith({
    to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
    params: { workspaceId: "workspace", projectId: "project-a" },
    search: { taskId: "a" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sub-task of Parent B" }));
  expect(navigate).toHaveBeenLastCalledWith(
    expect.objectContaining({
      params: { workspaceId: "workspace", projectId: "project-b" },
      search: { taskId: "b" },
    }),
  );
});

it("does not show an indicator for tasks without accessible parents", () => {
  const { container } = render(
    <TaskParentIndicator parents={[]} workspaceId="workspace" />,
  );
  expect(container).toBeEmptyDOMElement();
});

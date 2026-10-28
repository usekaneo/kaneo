import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { renderHook } from "@testing-library/react";
import { LayoutSwitch } from "./layout-switch";
import { PROJECT_VIEWS } from "./project-views";
import { useGoToProjectView } from "./use-go-to-project-view";

const m = vi.hoisted(() => ({
  navigate: vi.fn(),
  setViewMode: vi.fn(),
  setTaskLayout: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => m.navigate }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/store/user-preferences", () => ({
  useUserPreferencesStore: (selector: (state: typeof m) => unknown) =>
    selector(m),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderSwitch() {
  const { result } = renderHook(() =>
    useGoToProjectView({
      workspaceId: "w",
      projectId: "p",
      currentRoute: "board",
    }),
  );
  render(<LayoutSwitch currentView="board" onSelect={result.current} />);
}

it("offers only the layouts it is given", () => {
  const onSelect = vi.fn();
  render(
    <LayoutSwitch
      layouts={PROJECT_VIEWS.filter((view) => view.id !== "gantt")}
      currentView="list"
      onSelect={onSelect}
    />,
  );
  expect(screen.queryByRole("button", { name: "tasks:view.gantt" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "tasks:view.board" }));
  expect(onSelect).toHaveBeenCalledWith("board");
});

it("marks the current layout as pressed", () => {
  renderSwitch();
  expect(
    screen.getByRole("button", { name: "tasks:view.board" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    screen.getByRole("button", { name: "tasks:view.gantt" }),
  ).toHaveAttribute("aria-pressed", "false");
});

it("switches to list in place and navigates to other layouts", () => {
  renderSwitch();

  fireEvent.click(screen.getByRole("button", { name: "tasks:view.list" }));
  expect(m.setViewMode).toHaveBeenCalledWith("list");
  expect(m.navigate).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "tasks:calendar.title" }));
  expect(m.setTaskLayout).toHaveBeenCalledWith("calendar");
  expect(m.navigate).toHaveBeenCalledWith({
    to: "/dashboard/workspace/$workspaceId/project/$projectId/calendar",
    params: { workspaceId: "w", projectId: "p" },
  });
});

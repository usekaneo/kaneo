import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { LayoutSwitch } from "./layout-switch";

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
  render(
    <LayoutSwitch
      workspaceId="w"
      projectId="p"
      currentRoute="board"
      currentView="board"
    />,
  );
}

it("marks the current layout as pressed", () => {
  renderSwitch();
  expect(
    screen.getByRole("button", { name: "tasks:view.board" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    screen.getByRole("button", { name: "tasks:calendar.title" }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(screen.getAllByRole("button")).toHaveLength(3);
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

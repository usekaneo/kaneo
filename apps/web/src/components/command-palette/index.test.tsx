import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import CommandPalette from "./index";

const m = vi.hoisted(() => ({
  navigate: vi.fn(),
  shortcuts: {} as Record<string, () => void>,
  workspace: { id: "workspace-1" } as { id: string } | undefined,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/dashboard" }),
  useNavigate: () => m.navigate,
}));
vi.mock("@/lib/shortcuts/use-shortcut", () => ({
  useShortcut: (id: string, handler: () => void) => {
    m.shortcuts[id] = handler;
  },
}));
vi.mock("@/components/shortcuts/shortcut-keys", () => ({
  ShortcutKeys: () => null,
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: m.workspace }),
}));
vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => ({ data: undefined }),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: null }) },
}));
vi.mock("@/components/search-command-menu", () => ({ default: () => null }));
vi.mock("@/components/shared/modals/create-task-modal", () => ({
  default: () => null,
}));
vi.mock("@/components/shared/modals/create-workspace-modal", () => ({
  default: () => null,
}));
vi.mock("../shared/modals/create-project-modal", () => ({
  default: () => null,
}));

function openPalette() {
  render(<CommandPalette />);
  act(() => m.shortcuts.openCommandMenu());
}

describe("CommandPalette", () => {
  afterEach(() => {
    cleanup();
    m.navigate.mockReset();
    m.workspace = { id: "workspace-1" };
  });

  it("opens the members page of the active workspace", async () => {
    openPalette();

    fireEvent.click(
      await screen.findByText("navigation:commandPalette.members"),
    );

    expect(m.navigate).toHaveBeenCalledWith({
      to: "/dashboard/workspace/$workspaceId/members",
      params: { workspaceId: "workspace-1" },
    });
  });

  it("stays put without an active workspace", async () => {
    m.workspace = undefined;
    openPalette();

    fireEvent.click(
      await screen.findByText("navigation:commandPalette.members"),
    );

    expect(m.navigate).not.toHaveBeenCalled();
  });
});

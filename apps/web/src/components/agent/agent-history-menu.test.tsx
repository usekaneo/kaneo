import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import useAgentConversations from "@/hooks/queries/agent/use-agent-conversations";
import { AgentHistoryMenu } from "./agent-history-menu";

const state = vi.hoisted(() => ({
  data: [
    {
      id: "active",
      title: "Current conversation",
      updatedAt: "2026-11-02T10:00:00Z",
    },
    {
      id: "older",
      title: "Older conversation",
      updatedAt: "2026-11-01T10:00:00Z",
    },
  ],
  isPending: false,
  isError: false,
  isFetching: false,
  hasNextPage: true,
  fetchNextPage: vi.fn(),
  refetch: vi.fn(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/hooks/queries/agent/use-agent-conversations", () => ({
  default: vi.fn(() => state),
}));
vi.mock("@/lib/format", () => ({ formatRelativeTime: () => "recent" }));
beforeEach(() => {
  vi.clearAllMocks();
  state.isError = false;
  state.isFetching = false;
  state.hasNextPage = true;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AgentHistoryMenu", () => {
  it("loads another page without closing the menu or changing its scope and selection", async () => {
    const select = vi.fn();
    render(
      <AgentHistoryMenu
        workspaceId="workspace"
        projectId="project"
        activeId="active"
        onSelect={select}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "agent:panel.history" }),
    );
    await screen.findByRole("menu");
    expect(useAgentConversations).toHaveBeenLastCalledWith(
      "workspace",
      "project",
      true,
    );
    expect(
      screen.getByRole("menuitem", { name: /Current conversation/ }),
    ).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(
      screen.getByRole("menuitem", { name: "agent:panel.historyOlder" }),
    );
    expect(state.fetchNextPage).toHaveBeenCalledOnce();
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(select).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("menuitem", { name: /Older conversation/ }),
    );
    expect(select).toHaveBeenCalledWith("older");
  });

  it("retains existing conversations and offers retry when an older page fails", async () => {
    state.isError = true;
    render(
      <AgentHistoryMenu
        workspaceId="workspace"
        projectId="project"
        activeId="active"
        onSelect={() => {}}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "agent:panel.history" }),
    );
    await screen.findByRole("menu");
    expect(screen.getByText("Current conversation")).toBeInTheDocument();
    expect(screen.getByText("Older conversation")).toBeInTheDocument();
    expect(screen.getByText("agent:panel.historyError")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("menuitem", { name: "common:error.tryAgain" }),
    );
    expect(state.fetchNextPage).toHaveBeenCalledOnce();
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });
});

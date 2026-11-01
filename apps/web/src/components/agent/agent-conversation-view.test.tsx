import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { AgentConversationView } from "./agent-conversation-view";

const state = vi.hoisted(() => ({ userId: "viewer" }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));
vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: state.userId } }),
}));
vi.mock("@/hooks/queries/agent/use-agent-conversation", () => ({
  default: () => ({
    data: {
      id: "conversation",
      userId: "owner",
      sharedAt: "2026-10-28T10:00:00.000Z",
      owner: { id: "owner", name: "Mira Kowalski", image: null },
    },
  }),
}));
vi.mock("@/hooks/queries/agent/use-agent-conversation-runs", () => ({
  default: () => ({ data: [], isPending: false, isError: false }),
}));
vi.mock("@/hooks/queries/agent/use-agent-run", () => ({
  default: () => ({ data: undefined }),
}));
vi.mock("@/hooks/mutations/agent/use-send-agent-prompt", () => ({
  default: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/mutations/agent/use-cancel-agent-run", () => ({
  default: () => ({ mutate: vi.fn() }),
}));
vi.mock("./use-agent-attachments", () => ({
  useAgentAttachments: () => ({ toRunInput: () => [], clear: () => {} }),
}));
vi.mock("./agent-thread", () => ({
  AgentThread: ({ readOnly }: { readOnly?: boolean }) => (
    <div data-testid="thread" data-read-only={String(Boolean(readOnly))} />
  ),
}));
vi.mock("./agent-composer", () => ({
  AgentComposer: () => <div data-testid="composer" />,
}));
vi.mock("./agent-model-picker", () => ({ AgentModelPicker: () => null }));

afterEach(cleanup);

const renderView = () =>
  render(
    <AgentConversationView
      workspaceId="ws"
      conversationId="conversation"
      enabled
    />,
  );

describe("AgentConversationView", () => {
  it("is read-only for members viewing a shared conversation", () => {
    state.userId = "viewer";
    renderView();
    expect(screen.getByTestId("thread")).toHaveAttribute(
      "data-read-only",
      "true",
    );
    expect(screen.queryByTestId("composer")).not.toBeInTheDocument();
  });

  it("keeps the composer and review for the owner", () => {
    state.userId = "owner";
    renderView();
    expect(screen.getByTestId("thread")).toHaveAttribute(
      "data-read-only",
      "false",
    );
    expect(screen.getByTestId("composer")).toBeInTheDocument();
  });
});

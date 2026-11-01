import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { AgentConversationHeader } from "./agent-conversation-header";

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
vi.mock("@/hooks/mutations/agent/use-set-agent-conversation-sharing", () => ({
  default: () => ({ mutate: vi.fn(), isPending: false }),
}));

afterEach(cleanup);

describe("AgentConversationHeader", () => {
  it("names the owner of a shared conversation for viewers", () => {
    state.userId = "viewer";
    render(
      <AgentConversationHeader
        workspaceId="ws"
        conversationId="conversation"
      />,
    );
    expect(screen.getByText("Mira Kowalski")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "agent:sharing.shared" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the share toggle to the owner", () => {
    state.userId = "owner";
    render(
      <AgentConversationHeader
        workspaceId="ws"
        conversationId="conversation"
      />,
    );
    expect(
      screen.getByRole("button", { name: "agent:sharing.stop" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Mira Kowalski")).not.toBeInTheDocument();
  });
});

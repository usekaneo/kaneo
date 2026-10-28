import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { AgentShareButton } from "./agent-share-button";

const state = vi.hoisted(() => ({
  userId: "owner",
  sharedAt: null as string | null,
  mutate: vi.fn(),
}));

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
      sharedAt: state.sharedAt,
      owner: { id: "owner", name: "Mira Kowalski", image: null },
    },
  }),
}));
vi.mock("@/hooks/mutations/agent/use-set-agent-conversation-sharing", () => ({
  default: () => ({ mutate: state.mutate, isPending: false }),
}));

beforeEach(() => {
  state.userId = "owner";
  state.sharedAt = null;
  state.mutate.mockReset();
});
afterEach(cleanup);

const renderButton = () =>
  render(<AgentShareButton workspaceId="ws" conversationId="conversation" />);

describe("AgentShareButton", () => {
  it("lets the owner share a private conversation", () => {
    renderButton();
    fireEvent.click(
      screen.getByRole("button", { name: "agent:sharing.share" }),
    );
    expect(state.mutate).toHaveBeenCalledWith(true, expect.any(Object));
  });

  it("lets the owner stop sharing", () => {
    state.sharedAt = "2026-10-28T10:00:00.000Z";
    renderButton();
    fireEvent.click(screen.getByRole("button", { name: "agent:sharing.stop" }));
    expect(state.mutate).toHaveBeenCalledWith(false, expect.any(Object));
  });

  it("is hidden from members viewing a shared conversation", () => {
    state.userId = "viewer";
    state.sharedAt = "2026-10-28T10:00:00.000Z";
    const { container } = renderButton();
    expect(container).toBeEmptyDOMElement();
  });
});

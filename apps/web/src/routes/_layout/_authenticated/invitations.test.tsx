import { act, cleanup, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route } from "./invitations";

const config = vi.fn();
const authUser = vi.fn();
const getSession = vi.fn();
const pendingInvitations = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  useNavigate: () => vi.fn(),
}));

vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => config(),
}));

vi.mock("@/hooks/queries/invitation/use-pending-invitations", () => ({
  usePendingInvitations: () => pendingInvitations(),
}));

vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  default: () => ({ user: authUser(), refetchUser: vi.fn() }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    organization: {
      acceptInvitation: vi.fn(),
      rejectInvitation: vi.fn(),
      setActive: vi.fn(),
    },
    getSession: (options: unknown) => getSession(options),
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  Trans: ({ i18nKey }: { i18nKey: string }) => <span>{i18nKey}</span>,
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));

const InvitationsPage = (Route as unknown as { component: ComponentType })
  .component;

const invitation = {
  id: "invitation-1",
  workspaceId: "org-1",
  workspaceName: "Kaneo",
  inviterName: "Ada",
  role: "member",
  expiresAt: "2999-01-01T00:00:00.000Z",
};

beforeEach(() => {
  authUser.mockReturnValue({ id: "u1", name: "Sam", role: "user" });
  config.mockReturnValue({
    data: { disableWorkspaceCreation: false },
    isPending: false,
  });
  pendingInvitations.mockReturnValue({ data: [], isLoading: false });
  // Better Auth resolves with `{ data, error }` and does not reject.
  getSession.mockResolvedValue({
    data: { user: { id: "u1", role: "user" } },
    error: null,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const continueToSetup = () => screen.queryByText("invitations:continueToSetup");
const skipForNow = () => screen.queryByText("invitations:skipForNow");

// Neither control decides until the one-shot role refresh settles.
const settled = () => act(async () => {});

async function renderPage(node: ReactNode) {
  render(node);
  await settled();
}

describe("InvitationsPage", () => {
  describe("with no invitation to accept", () => {
    it("offers to continue to setup when creation is open", async () => {
      await renderPage(<InvitationsPage />);

      expect(continueToSetup()).toBeInTheDocument();
    });

    it("hides it from a restricted user, who has nowhere to continue to", async () => {
      config.mockReturnValue({
        data: { disableWorkspaceCreation: true },
        isPending: false,
      });

      await renderPage(<InvitationsPage />);

      // The onboarding screen it leads to would only send them back here.
      expect(continueToSetup()).not.toBeInTheDocument();
    });

    it("keeps it for an instance admin when creation is restricted", async () => {
      config.mockReturnValue({
        data: { disableWorkspaceCreation: true },
        isPending: false,
      });
      getSession.mockResolvedValue({
        data: { user: { id: "u1", role: "admin" } },
        error: null,
      });

      await renderPage(<InvitationsPage />);

      expect(continueToSetup()).toBeInTheDocument();
    });
  });

  describe("with an invitation waiting", () => {
    beforeEach(() => {
      pendingInvitations.mockReturnValue({
        data: [invitation],
        isLoading: false,
      });
    });

    it("offers to skip when creation is open", async () => {
      await renderPage(<InvitationsPage />);

      expect(skipForNow()).toBeInTheDocument();
    });

    it("hides the skip from a restricted user", async () => {
      config.mockReturnValue({
        data: { disableWorkspaceCreation: true },
        isPending: false,
      });

      await renderPage(<InvitationsPage />);

      // Skipping exists to go and create a workspace instead. Restricted,
      // it leads away from the invitation with no way back to it.
      expect(skipForNow()).not.toBeInTheDocument();
      // The invitation itself is still there to accept.
      expect(screen.getByText("Kaneo")).toBeInTheDocument();
    });

    it("keeps the skip for an instance admin", async () => {
      config.mockReturnValue({
        data: { disableWorkspaceCreation: true },
        isPending: false,
      });
      getSession.mockResolvedValue({
        data: { user: { id: "u1", role: "admin" } },
        error: null,
      });

      await renderPage(<InvitationsPage />);

      expect(skipForNow()).toBeInTheDocument();
    });

    it("waits for the config rather than offering a skip it will withdraw", async () => {
      config.mockReturnValue({ data: undefined, isPending: true });

      await renderPage(<InvitationsPage />);

      expect(skipForNow()).not.toBeInTheDocument();
    });

    it("offers the skip when the config request fails", async () => {
      // Settled with no data is an error, not a restriction, and this page
      // has no view to fall back to.
      config.mockReturnValue({ data: undefined, isPending: false });

      await renderPage(<InvitationsPage />);

      expect(skipForNow()).toBeInTheDocument();
    });
  });
});

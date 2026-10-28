import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { Route } from "./accept.$inviteId";

const m = vi.hoisted(() => ({
  navigate: vi.fn(),
  session: { data: null as unknown, isPending: false },
  details: {} as Record<string, unknown>,
  acceptInvitation: vi.fn(),
  setActive: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
  useNavigate: () => m.navigate,
  useParams: () => ({ inviteId: "invitation-1" }),
}));
vi.mock("@/hooks/queries/invitation/use-get-invitation-details", () => ({
  useGetInvitationDetails: () => m.details,
}));
vi.mock("@/hooks/queries/config/use-get-config", () => ({
  default: () => ({ data: undefined }),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => m.session,
    signOut: m.signOut,
    organization: {
      acceptInvitation: m.acceptInvitation,
      setActive: m.setActive,
    },
  },
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("@/lib/format", () => ({ formatDateMedium: () => "Jan 1, 2999" }));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const AcceptInvitation = (Route as unknown as { component: ComponentType })
  .component;

const invitation = {
  id: "invitation-1",
  email: "invitee@kaneo.test",
  workspaceName: "Kaneo",
  inviterName: "Ada",
  expiresAt: "2999-01-01T00:00:00.000Z",
  status: "pending",
  expired: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  m.session = { data: null, isPending: false };
  m.details = {
    data: { valid: true, invitation },
    isLoading: false,
    error: null,
  };
  m.acceptInvitation.mockResolvedValue({
    data: { invitation: { organizationId: "workspace-1" } },
    error: null,
  });
  m.signOut.mockResolvedValue({});
});
afterEach(cleanup);

describe("signed-out invitee", () => {
  it("sends an invitee without an account to sign-up with the invitation", () => {
    render(<AcceptInvitation />);
    fireEvent.click(
      screen.getByRole("button", { name: "auth:invitation.createAccount" }),
    );
    expect(m.navigate).toHaveBeenCalledWith({
      to: "/auth/sign-up",
      search: { invitationId: "invitation-1", email: "invitee@kaneo.test" },
    });
  });

  it("keeps the sign-in route for invitees who already have an account", () => {
    render(<AcceptInvitation />);
    fireEvent.click(
      screen.getByRole("button", { name: "auth:invitation.signIn" }),
    );
    expect(m.navigate).toHaveBeenCalledWith({
      to: "/auth/sign-in",
      search: { invitationId: "invitation-1", email: "invitee@kaneo.test" },
    });
  });
});

describe("signed-in invitee", () => {
  it("joins the workspace when the invited email is signed in", async () => {
    m.session = {
      data: { user: { email: "Invitee@kaneo.test", name: "Invitee" } },
      isPending: false,
    };
    render(<AcceptInvitation />);
    fireEvent.click(
      screen.getByRole("button", { name: "auth:invitation.join" }),
    );
    await waitFor(() =>
      expect(m.navigate).toHaveBeenCalledWith({
        to: "/dashboard/workspace/$workspaceId",
        params: { workspaceId: "workspace-1" },
      }),
    );
    expect(m.acceptInvitation).toHaveBeenCalledWith({
      invitationId: "invitation-1",
    });
    expect(m.setActive).toHaveBeenCalledWith({ organizationId: "workspace-1" });
  });

  it("offers to switch accounts instead of a join that would fail", async () => {
    m.session = {
      data: { user: { email: "someone@else.test", name: "Someone" } },
      isPending: false,
    };
    render(<AcceptInvitation />);
    expect(screen.getByText("auth:invitation.mismatch.title")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "auth:invitation.join" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "auth:invitation.switchAccount" }),
    );
    await waitFor(() =>
      expect(m.navigate).toHaveBeenCalledWith({
        to: "/auth/sign-in",
        search: { invitationId: "invitation-1", email: "invitee@kaneo.test" },
      }),
    );
    expect(m.signOut).toHaveBeenCalledTimes(1);
    expect(m.acceptInvitation).not.toHaveBeenCalled();
  });
});

describe("unusable invitations", () => {
  it("names the inviter when the invitation expired", () => {
    m.details = {
      data: {
        valid: false,
        invitation: { ...invitation, expired: true },
        error: "This invitation has expired",
      },
      isLoading: false,
      error: null,
    };
    render(<AcceptInvitation />);
    expect(screen.getByText("auth:invitation.expired.title")).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("explains an invitation that was accepted or canceled", () => {
    m.details = {
      data: { valid: false, error: "This invitation has been canceled" },
      isLoading: false,
      error: null,
    };
    render(<AcceptInvitation />);
    expect(screen.getByText("auth:invitation.invalid.title")).toBeVisible();
  });
});

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MembersTable from "./members-table";

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockWriteText = vi.fn();

const permissions = {
  canInvite: true,
};

vi.mock("@kaneo/permissions", () => ({
  DEFAULT_ROLE_NAMES: ["viewer", "member", "admin"],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({
    canManageTeam: () => false,
    canRemoveMembers: () => false,
    canInviteUsers: () => permissions.canInvite,
  }),
}));

vi.mock("@/hooks/mutations/workspace-user/use-cancel-invitation", () => ({
  default: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/hooks/mutations/workspace-user/use-delete-workspace-user", () => ({
  default: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock(
  "@/hooks/mutations/workspace-user/use-update-workspace-user-role",
  () => ({
    default: () => ({
      mutateAsync: vi.fn(),
      isPending: false,
    }),
  }),
);

vi.mock("@/hooks/queries/workspace/use-workspace-roles", () => ({
  default: () => ({
    data: [],
  }),
}));

vi.mock("@/components/providers/auth-provider/hooks/use-auth", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/lib/toast", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock("@/lib/format", () => ({
  formatDateMedium: () => "Aug 1, 2026",
}));

const pendingInvitation = {
  id: "inv-123",
  email: "guest@example.com",
  role: "member",
  status: "pending",
  expiresAt: "2026-08-01T00:00:00.000Z",
};

function renderMembersTable() {
  return render(
    <MembersTable
      workspaceId="ws-1"
      users={[]}
      invitations={[pendingInvitation]}
    />,
  );
}

describe("MembersTable pending invite link", () => {
  beforeEach(() => {
    permissions.canInvite = true;
    mockToastSuccess.mockReset();
    mockToastError.mockReset();
    mockWriteText.mockReset();
    mockWriteText.mockResolvedValue(undefined);

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: mockWriteText,
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("copies invite link when pending badge is clicked and user can invite", async () => {
    renderMembersTable();

    fireEvent.click(
      screen.getByRole("button", {
        name: "team:membersTable.copyInviteLinkAria",
      }),
    );

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(
        `${window.location.origin}/invitation/accept/inv-123`,
      );
    });
    expect(mockToastSuccess).toHaveBeenCalledWith(
      "team:membersTable.copyInviteLinkSuccess",
    );
  });

  it("renders non-clickable pending badge when user cannot invite", () => {
    permissions.canInvite = false;

    renderMembersTable();

    expect(
      screen.queryByRole("button", {
        name: "team:membersTable.copyInviteLinkAria",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("team:invitations.pendingBadge"),
    ).toBeInTheDocument();
  });

  it("shows error toast when clipboard write fails", async () => {
    mockWriteText.mockRejectedValueOnce(new Error("clipboard denied"));

    renderMembersTable();

    fireEvent.click(
      screen.getByRole("button", {
        name: "team:membersTable.copyInviteLinkAria",
      }),
    );

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("clipboard denied");
    });
  });
});

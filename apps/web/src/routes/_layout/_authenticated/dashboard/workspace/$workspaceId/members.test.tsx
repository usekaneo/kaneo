import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { Route } from "./members";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    ...(options as Record<string, unknown>),
    useParams: () => ({ workspaceId: "workspace-1" }),
  }),
}));

// Deliberately no `invitations` key: that absence is the bug this pins. The
// page used to read pending invites off the `getFullOrganization` payload, so
// with that payload lacking the field the pending section was permanently
// empty. Only the dedicated invites query carries pending invites.
vi.mock("@/hooks/queries/workspace/use-get-full-workspace", () => ({
  default: () => ({ data: { members: [] } }),
}));

vi.mock("@/hooks/queries/workspace-users/use-get-workspace-invites", () => ({
  default: () => ({
    data: [
      {
        id: "invite-1",
        email: "pending@example.com",
        role: "member",
        status: "pending",
      },
    ],
  }),
}));

vi.mock("@/components/team/members-table", () => ({
  default: ({
    invitations,
  }: {
    invitations: { id: string; email: string }[];
  }) => (
    <ul>
      {invitations.map((invitation) => (
        <li key={invitation.id}>{invitation.email}</li>
      ))}
    </ul>
  ),
}));

vi.mock("@/components/common/workspace-layout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("@/components/team/invite-team-member-modal", () => ({
  default: () => null,
}));
vi.mock("@/hooks/use-workspace-permission", () => ({
  useWorkspacePermission: () => ({ canInviteUsers: () => true }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const MembersRoute = (Route as unknown as { component: ComponentType })
  .component;

afterEach(() => cleanup());

describe("workspace members page pending invitations", () => {
  it("passes pending invites from the dedicated invites query to the table", () => {
    render(<MembersRoute />);

    expect(screen.getByText("pending@example.com")).toBeInTheDocument();
  });
});

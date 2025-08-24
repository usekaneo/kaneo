import type { authClient } from "@/lib/auth-client";

export type WorkspaceUser = NonNullable<
  Awaited<ReturnType<typeof authClient.organization.listMembers>>["data"]
>[number];

// Active workspace member (current user's membership)
export type ActiveWorkspaceUser = NonNullable<
  Awaited<ReturnType<typeof authClient.organization.getActiveMember>>["data"]
>;

// Workspace invitation types
export type WorkspaceUserInvitation = NonNullable<
  Awaited<ReturnType<typeof authClient.organization.listInvitations>>["data"]
>[number];

export type UserInvitation = NonNullable<
  Awaited<
    ReturnType<typeof authClient.organization.listUserInvitations>
  >["data"]
>[number];

export default WorkspaceUser;

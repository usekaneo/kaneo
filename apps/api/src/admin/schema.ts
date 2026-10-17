import { pagingNumber, z } from "../openapi";

export const listAdminUsersQuery = z.object({
  search: z.string().max(200).optional().openapi({
    description: "Case-insensitive match against user name or email.",
  }),
  page: pagingNumber(1, 1_000_000, 1),
  limit: pagingNumber(1, 100, 20),
});

export const listAdminWorkspacesQuery = z.object({
  search: z.string().max(200).optional().openapi({
    description: "Case-insensitive match against workspace name or slug.",
  }),
  page: pagingNumber(1, 1_000_000, 1),
  limit: pagingNumber(1, 100, 20),
});

export const adminWorkspaceParam = z.object({ workspaceId: z.string() });

export const adminWorkspaceMemberParam = z.object({
  workspaceId: z.string(),
  userId: z.string(),
});

const assignableRole = z.string().min(1).max(100).openapi({
  description:
    "A built-in role (viewer, member, admin) or one of the workspace's custom roles. Use the ownership endpoint to make someone the owner.",
});

export const addAdminWorkspaceMemberBody = z.object({
  userId: z.string().min(1),
  role: assignableRole,
});

export const updateAdminWorkspaceMemberRoleBody = z.object({
  role: assignableRole,
});

export const transferAdminWorkspaceOwnershipBody = z.object({
  userId: z.string().min(1).openapi({
    description:
      "An existing member who becomes the only owner. Previous owners become admins.",
  }),
});

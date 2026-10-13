import { z } from "../openapi";

const isoTimestamp = z.string().openapi({ format: "date-time" });

export const adminUserSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    image: z.string().nullable(),
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp,
    role: z.string().nullable(),
    banned: z.boolean(),
    banReason: z.string().nullable(),
    banExpires: isoTimestamp.nullable(),
  })
  .openapi("AdminUser");

export const adminUserListSchema = z
  .object({
    users: z.array(adminUserSchema),
    total: z.number().int().openapi({
      description: "Number of users matching the search, across all pages.",
    }),
  })
  .openapi("AdminUserList");

const adminWorkspaceOwnerSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
});

export const adminWorkspaceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    createdAt: isoTimestamp,
    memberCount: z.number().int(),
    projectCount: z.number().int(),
    owners: z.array(adminWorkspaceOwnerSchema),
  })
  .openapi("AdminWorkspace");

export const adminWorkspaceListSchema = z
  .object({
    workspaces: z.array(adminWorkspaceSchema),
    total: z.number().int().openapi({
      description:
        "Number of workspaces matching the search, across all pages.",
    }),
  })
  .openapi("AdminWorkspaceList");

export const adminWorkspaceMemberSchema = z
  .object({
    userId: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullable(),
    role: z.string(),
    joinedAt: isoTimestamp,
  })
  .openapi("AdminWorkspaceMember");

export const adminWorkspaceMemberListSchema = z.array(
  adminWorkspaceMemberSchema,
);

export const adminWorkspaceRoleListSchema = z.array(z.string()).openapi({
  description: "Role names an administrator can assign in the workspace.",
});

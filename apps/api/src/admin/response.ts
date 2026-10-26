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

export const adminAuditLogEntrySchema = z
  .object({
    id: z.string(),
    createdAt: isoTimestamp,
    action: z.string().openapi({
      description: "Dotted action name, for example `user.role_changed`.",
    }),
    actor: z.object({
      id: z.string().nullable().openapi({
        description: "Null when the administrator's account was deleted.",
      }),
      name: z.string().nullable(),
      email: z.string().nullable(),
    }),
    targetType: z.string(),
    targetId: z.string().nullable(),
    targetLabel: z.string().nullable().openapi({
      description: "The target's name or email when the action happened.",
    }),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    ipAddress: z.string().nullable(),
    userAgent: z.string().nullable(),
  })
  .openapi("AdminAuditLogEntry");

export const adminAuditLogSchema = z
  .object({
    entries: z.array(adminAuditLogEntrySchema),
    total: z.number().int().openapi({
      description: "Number of entries matching the filters, across all pages.",
    }),
  })
  .openapi("AdminAuditLog");

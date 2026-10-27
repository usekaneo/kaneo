import { pagingNumber, z } from "../openapi";

export const listAdminUsersQuery = z.object({
  search: z.string().max(200).optional().openapi({
    description: "Case-insensitive match against user name or email.",
  }),
  status: z.enum(["active", "deactivated"]).optional().openapi({
    description: "Only active or only deactivated accounts.",
  }),
  role: z.string().min(1).max(64).optional().openapi({
    description:
      "Only users with this instance role: `admin`, a custom role name, or `user` for everyone without an administrator or custom role.",
  }),
  emailVerified: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional()
    .openapi({
      type: "string",
      enum: ["true", "false"],
      description: "Only users whose email is verified, or is not.",
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

export const listAdminAuditLogQuery = z.object({
  action: z
    .string()
    .max(100)
    .regex(/^[a-z_]+(\.[a-z_]+)?$/, "Expected an action or action category")
    .optional()
    .openapi({
      description:
        "An exact action such as `user.deleted`, or a category such as `user` to match every `user.*` action.",
    }),
  actorId: z.string().max(200).optional().openapi({
    description: "Only entries performed by this user id.",
  }),
  targetType: z.string().max(100).optional().openapi({
    description: "Only entries about this kind of target, such as `user`.",
  }),
  targetId: z.string().max(200).optional().openapi({
    description: "Only entries about this target id.",
  }),
  page: pagingNumber(1, 1_000_000, 1),
  limit: pagingNumber(1, 100, 25),
});

export const adminUserParam = z.object({ userId: z.string().min(1) });

const instanceRoleName = z.string().min(1).max(64).openapi({
  description:
    "Instance role: `admin` administers the instance, `user` has no instance permissions, or the name of a custom role. Only administrators can assign `admin`, and nobody can assign a role with permissions they don't have.",
});

export const createAdminUserBody = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.email().max(254).openapi({
    description:
      "The new user's email address. They sign in with it and receive their password link there.",
  }),
  role: instanceRoleName.default("user"),
});

export const updateAdminUserBody = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    email: z.email().max(254).optional().openapi({
      description:
        "A new address must be verified again. It can't belong to another user.",
    }),
    role: instanceRoleName.optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: "Nothing to update",
  });

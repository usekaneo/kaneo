import {
  CUSTOM_ROLE_PERMISSIONS,
  INSTANCE_PERMISSIONS,
  INSTANCE_ROLE_NAME_PATTERN,
} from "@kaneo/permissions";
import { z } from "../../openapi";

const permissionList = z
  .array(z.enum(CUSTOM_ROLE_PERMISSIONS))
  .max(CUSTOM_ROLE_PERMISSIONS.length * 2)
  .transform((permissions) =>
    CUSTOM_ROLE_PERMISSIONS.filter((permission) =>
      permissions.includes(permission),
    ),
  )
  .openapi({
    description:
      "Instance permissions the role grants. `roles:manage` belongs to the built-in admin role only.",
  });

export const instanceRoleBody = z.object({
  name: z
    .string()
    .regex(
      INSTANCE_ROLE_NAME_PATTERN,
      "Use 2-32 lowercase letters, digits, or hyphens, starting with a letter",
    )
    .openapi({
      description:
        "Lowercase letters, digits and hyphens, starting with a letter. `admin` and `user` are reserved.",
      example: "support",
    }),
  permissions: permissionList,
});

export const instanceRoleParam = z.object({ roleId: z.string().min(1) });

const isoTimestamp = z.string().openapi({ format: "date-time" });

export const instanceRoleSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    permissions: z.array(z.enum(CUSTOM_ROLE_PERMISSIONS)),
    userCount: z.number().int().openapi({
      description: "Users who currently have this role.",
    }),
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp,
  })
  .openapi("InstanceRole");

export const instanceRoleListSchema = z
  .object({ roles: z.array(instanceRoleSchema) })
  .openapi("InstanceRoleList");

export const deletedInstanceRoleSchema = z
  .object({ id: z.string() })
  .openapi("DeletedInstanceRole");

export const instanceAccessSchema = z
  .object({
    permissions: z.array(z.enum(INSTANCE_PERMISSIONS)),
  })
  .openapi("InstanceAccess");

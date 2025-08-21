import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";
import { z } from "zod";

export const roleSchema = z.enum(["owner", "admin", "member"]);
export type Role = z.infer<typeof roleSchema>;

export const statement = {
  ...defaultStatements, // Include default org/member/invitation permissions
  project: ["create", "read", "update", "delete", "share"],
  task: ["create", "read", "update", "delete", "assign"],
  workspace: ["read", "update", "delete", "manage_settings"],
  team: ["invite", "remove", "manage_roles"],
} as const;

export const ac = createAccessControl(statement);

export const rolePermissions = {
  member: ac.newRole({
    ...memberAc.statements,
    project: ["create", "read"],
    task: ["create", "read", "update"],
    workspace: ["read"],
    team: ["invite"], // Members can invite others
  }),
  admin: ac.newRole({
    ...adminAc.statements,
    project: ["create", "read", "update", "delete", "share"],
    task: ["create", "read", "update", "delete", "assign"],
    workspace: ["read", "update", "manage_settings"],
    team: ["invite", "remove", "manage_roles"],
  }),
  owner: ac.newRole({
    ...ownerAc.statements,
    project: ["create", "read", "update", "delete", "share"],
    task: ["create", "read", "update", "delete", "assign"],
    workspace: ["read", "update", "delete", "manage_settings"],
    team: ["invite", "remove", "manage_roles"],
  }),
} as const;

export const { member, admin, owner } = rolePermissions;

export const validateRole = (role: string): role is Role => {
  return roleSchema.safeParse(role).success;
};

export const getRolePermissions = (role: Role) => {
  return rolePermissions[role];
};

export type PermissionStatement = typeof statement;

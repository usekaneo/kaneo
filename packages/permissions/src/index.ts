import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

export const statement = {
  ...defaultStatements,
  project: ["create", "read", "update", "delete", "share"],
  task: ["create", "read", "update", "delete", "assign"],
  label: ["create", "read", "update", "delete"],
  workspace: ["read", "update", "delete", "manage_settings"],
  // Everyone may log, see and edit their own time; these grant the same for
  // other people's entries (timesheets, corrections).
  timeEntry: ["read_all", "manage_all"],
  // Company layer. Everyone always sees their own profile, attendance,
  // activity, requests and pay; these cover other people's.
  people: ["read_all", "manage"],
  activity: ["read_all"],
  request: ["approve"],
  payroll: ["read", "manage"],
  audit: ["read"],
  // Workspace files. Everyone who works in the workspace can upload and share
  // their own; manage covers other people's files.
  file: ["upload", "manage"],
} as const;

export const ac = createAccessControl(statement);

export const viewer = ac.newRole({
  ...memberAc.statements,
  project: ["read"],
  task: ["read"],
  label: ["read"],
  workspace: ["read"],
});

export const member = ac.newRole({
  ...memberAc.statements,
  project: ["create", "read"],
  task: ["create", "read", "update"],
  label: ["create", "read", "update", "delete"],
  workspace: ["read"],
  file: ["upload"],
});

// Runs a team day to day: sees people, time and activity, approves leave and
// expenses, but not pay or workspace settings.
export const manager = ac.newRole({
  ...memberAc.statements,
  project: ["create", "read", "update"],
  task: ["create", "read", "update", "delete", "assign"],
  label: ["create", "read", "update", "delete"],
  workspace: ["read"],
  timeEntry: ["read_all"],
  people: ["read_all"],
  activity: ["read_all"],
  request: ["approve"],
  file: ["upload"],
});

export const admin = ac.newRole({
  ...adminAc.statements,
  project: ["create", "read", "update", "delete", "share"],
  task: ["create", "read", "update", "delete", "assign"],
  label: ["create", "read", "update", "delete"],
  workspace: ["read", "update", "manage_settings"],
  timeEntry: ["read_all", "manage_all"],
  people: ["read_all", "manage"],
  activity: ["read_all"],
  request: ["approve"],
  payroll: ["read", "manage"],
  audit: ["read"],
  file: ["upload", "manage"],
});

export const owner = ac.newRole({
  ...ownerAc.statements,
  project: ["create", "read", "update", "delete", "share"],
  task: ["create", "read", "update", "delete", "assign"],
  label: ["create", "read", "update", "delete"],
  workspace: ["read", "update", "delete", "manage_settings"],
  timeEntry: ["read_all", "manage_all"],
  people: ["read_all", "manage"],
  activity: ["read_all"],
  request: ["approve"],
  payroll: ["read", "manage"],
  audit: ["read"],
  file: ["upload", "manage"],
});

export const builtInRoles = { viewer, member, manager, admin, owner } as const;

export type BuiltInRoleName = keyof typeof builtInRoles;

// Default-role names that the API seeds per workspace. These ARE editable in
// the UI (their permissions live as rows in `workspace_role`), but their names
// are reserved and the rows are auto-created on workspace creation /
// backfilled at boot. `owner` is intentionally NOT in this list because it
// stays a true static role on the better-auth side.
export const DEFAULT_ROLE_NAMES = [
  "viewer",
  "member",
  "manager",
  "admin",
] as const;
export type DefaultRoleName = (typeof DEFAULT_ROLE_NAMES)[number];

function toMutablePayload(
  statements: Record<string, readonly string[]>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [resource, actions] of Object.entries(statements)) {
    out[resource] = [...actions];
  }
  return out;
}

// Plain JSON-serializable permission payloads for the seeded default roles.
// Mirrors each role's `.statements` (including better-auth's organization/
// member/team/invitation/ac defaults) so a workspace_role row that uses one
// of these has parity with the prior static definition.
export const defaultRolePayloads: Record<
  DefaultRoleName,
  Record<string, string[]>
> = {
  viewer: toMutablePayload(viewer.statements),
  member: toMutablePayload(member.statements),
  manager: toMutablePayload(manager.statements),
  admin: toMutablePayload(admin.statements),
};

type Statements = Record<string, readonly string[]>;

// A role may only be granted by someone who already holds every permission
// it carries; otherwise inviting or promoting would be a way to escalate.
// Each side is a list because a member's role string can name several roles.
export function coversPermissions(
  granter: Statements[],
  target: Statements[],
): boolean {
  const held = new Map<string, Set<string>>();
  for (const statements of granter) {
    for (const [resource, actions] of Object.entries(statements)) {
      const set = held.get(resource) ?? new Set<string>();
      for (const action of actions) set.add(action);
      held.set(resource, set);
    }
  }
  return target.every((statements) =>
    Object.entries(statements).every(([resource, actions]) =>
      actions.every((action) => held.get(resource)?.has(action)),
    ),
  );
}

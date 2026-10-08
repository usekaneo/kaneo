import { Effect, Schema } from "effect";
import { KaneoApi } from "./kaneo-api.js";

const PAGE_SIZE = 100;

export const OrganizationMember = Schema.Struct({
  id: Schema.String,
  userId: Schema.String,
  role: Schema.String,
  createdAt: Schema.Unknown,
  user: Schema.Struct({
    name: Schema.String,
    email: Schema.String,
  }),
});
export type OrganizationMember = typeof OrganizationMember.Type;

const MemberPage = Schema.Struct({
  members: Schema.Array(OrganizationMember),
  total: Schema.Number,
});

const ChangedMember = Schema.Struct({ id: Schema.String, role: Schema.String });

const RemovedMember = Schema.Struct({ member: ChangedMember });

const UpdatedMember = Schema.Union([ChangedMember, RemovedMember]);

export function unwrapMember(
  value: typeof UpdatedMember.Type,
): typeof ChangedMember.Type {
  return "member" in value ? value.member : value;
}

const PermissionCheck = Schema.Struct({ success: Schema.Boolean });

const RoleList = Schema.Array(Schema.Struct({ role: Schema.String }));

export const listOrganizationMembers = Effect.fnUntraced(function* (
  workspaceId: string,
) {
  const api = yield* KaneoApi;
  const members: OrganizationMember[] = [];
  for (;;) {
    const page = yield* api.request(
      "GET",
      "/api/auth/organization/list-members",
      MemberPage,
      {
        query: {
          organizationId: workspaceId,
          limit: PAGE_SIZE,
          offset: members.length,
        },
      },
    );
    members.push(...page.members);
    if (page.members.length === 0 || members.length >= page.total) {
      return members;
    }
  }
});

export const listCustomRoles = Effect.fnUntraced(function* (
  workspaceId: string,
) {
  const api = yield* KaneoApi;
  const roles = yield* api.request(
    "GET",
    "/api/auth/organization/list-roles",
    RoleList,
    { query: { organizationId: workspaceId } },
  );
  return roles.map((entry) => entry.role);
});

export const hasWorkspacePermission = Effect.fnUntraced(function* (
  workspaceId: string,
  permissions: Readonly<Record<string, ReadonlyArray<string>>>,
) {
  const api = yield* KaneoApi;
  const result = yield* api.request(
    "POST",
    "/api/auth/organization/has-permission",
    PermissionCheck,
    { body: { organizationId: workspaceId, permissions } },
  );
  return result.success;
});

export const removeOrganizationMember = Effect.fnUntraced(function* (
  workspaceId: string,
  memberId: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "POST",
    "/api/auth/organization/remove-member",
    RemovedMember,
    { body: { organizationId: workspaceId, memberIdOrEmail: memberId } },
  );
});

export const updateOrganizationMemberRole = Effect.fnUntraced(function* (
  workspaceId: string,
  memberId: string,
  role: string,
) {
  const api = yield* KaneoApi;
  const updated = yield* api.request(
    "POST",
    "/api/auth/organization/update-member-role",
    UpdatedMember,
    { body: { organizationId: workspaceId, memberId, role } },
  );
  return unwrapMember(updated);
});

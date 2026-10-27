import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireInstancePermission } from "./roles/require-instance-permission";
import { requireUserSession } from "../utils/require-user-session";
import { adminAuditRequest } from "./audit/admin-audit-request";
import addWorkspaceMember from "./controllers/add-workspace-member";
import archiveWorkspace from "./controllers/archive-workspace";
import deleteWorkspace from "./controllers/delete-workspace";
import getOverview from "./controllers/get-overview";
import { adminOverviewSchema } from "./overview/response";
import listAuditLog from "./controllers/list-audit-log";
import getSystemStatus from "./controllers/get-system-status";
import listUsers from "./controllers/list-users";
import listWorkspaceMembers from "./controllers/list-workspace-members";
import listWorkspaceRoles from "./controllers/list-workspace-roles";
import listWorkspaces from "./controllers/list-workspaces";
import removeWorkspaceMember from "./controllers/remove-workspace-member";
import sendAdminTestEmail from "./controllers/send-test-email";
import restoreWorkspace from "./controllers/restore-workspace";
import transferWorkspaceOwnership from "./controllers/transfer-workspace-ownership";
import updateWorkspaceMemberRole from "./controllers/update-workspace-member-role";
import adminRoleRoutes from "./role-routes";
import adminSettingsRoutes from "./settings-routes";
import { getUserAccess } from "./roles/get-instance-access";
import { instanceAccessSchema } from "./roles/schema";
import adminUserAccountRoutes from "./user-account-routes";
import adminUserRoutes from "./user-routes";
import {
  adminAuditLogSchema,
  adminDeletedWorkspaceSchema,
  adminUserListSchema,
  adminWorkspaceArchiveStateSchema,
  adminWorkspaceListSchema,
  adminWorkspaceMemberListSchema,
  adminWorkspaceRoleListSchema,
} from "./response";
import {
  addAdminWorkspaceMemberBody,
  adminWorkspaceMemberParam,
  adminWorkspaceParam,
  listAdminAuditLogQuery,
  listAdminUsersQuery,
  listAdminWorkspacesQuery,
  transferAdminWorkspaceOwnershipBody,
  updateAdminWorkspaceMemberRoleBody,
} from "./schema";
import {
  adminSystemStatusSchema,
  adminTestEmailResultSchema,
} from "./system/response";
import { adminUserSecurityRoutes } from "./user-security-routes";

const forbidden = errorResponse(
  "The caller lacks the instance permission or is authenticated with an API key",
);

const getAccessRoute = createRoute({
  method: "get",
  operationId: "getAdminAccess",
  path: "/access",
  tags: ["Admin"],
  summary: "Get your instance permissions",
  description:
    "List the instance permissions the signed-in user's roles grant. Empty for users without an administrator or custom role. API keys are rejected.",
  middleware: [requireUserSession] as const,
  responses: {
    200: jsonResponse(
      "The caller's instance permissions",
      instanceAccessSchema,
    ),
    403: errorResponse("The request used an API key"),
  },
});

const listUsersRoute = createRoute({
  method: "get",
  operationId: "listAdminUsers",
  path: "/users",
  tags: ["Admin"],
  summary: "List instance users",
  description:
    "Page through every user account on this instance, newest first, optionally filtered by a case-insensitive name or email search, status, instance role, and email verification. Each user lists their linked sign-in methods and last session activity. Requires the `users:read` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("users:read"),
  ] as const,
  request: { query: listAdminUsersQuery },
  responses: {
    200: jsonResponse("Users matching the search", adminUserListSchema),
    400: errorResponse("Invalid search, page, or limit"),
    403: forbidden,
  },
});

const listWorkspacesRoute = createRoute({
  method: "get",
  operationId: "listAdminWorkspaces",
  path: "/workspaces",
  tags: ["Admin"],
  summary: "List instance workspaces",
  description:
    "Page through every workspace on this instance with its owners, member count, project count and archive state, optionally filtered by a case-insensitive name or slug search. Requires the `workspaces:read` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("workspaces:read"),
  ] as const,
  request: { query: listAdminWorkspacesQuery },
  responses: {
    200: jsonResponse(
      "Workspaces matching the search",
      adminWorkspaceListSchema,
    ),
    400: errorResponse("Invalid search, page, or limit"),
    403: forbidden,
  },
});

const listWorkspaceMembersRoute = createRoute({
  method: "get",
  operationId: "listAdminWorkspaceMembers",
  path: "/workspaces/{workspaceId}/members",
  tags: ["Admin"],
  summary: "List workspace members",
  description:
    "List every member of a workspace with their role, whether or not the administrator belongs to it. Requires the `workspaces:read` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("workspaces:read"),
  ] as const,
  request: { params: adminWorkspaceParam },
  responses: {
    200: jsonResponse("Workspace members", adminWorkspaceMemberListSchema),
    403: forbidden,
    404: errorResponse("Workspace not found"),
  },
});

const listWorkspaceRolesRoute = createRoute({
  method: "get",
  operationId: "listAdminWorkspaceRoles",
  path: "/workspaces/{workspaceId}/roles",
  tags: ["Admin"],
  summary: "List assignable workspace roles",
  description:
    "List the roles an administrator can give members of a workspace: the built-in viewer, member and admin roles plus the workspace's custom roles. Ownership is changed with the ownership transfer instead. Requires the `workspaces:read` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("workspaces:read"),
  ] as const,
  request: { params: adminWorkspaceParam },
  responses: {
    200: jsonResponse("Assignable role names", adminWorkspaceRoleListSchema),
    403: forbidden,
    404: errorResponse("Workspace not found"),
  },
});

const addWorkspaceMemberRoute = createRoute({
  method: "post",
  operationId: "addAdminWorkspaceMember",
  path: "/workspaces/{workspaceId}/members",
  tags: ["Admin"],
  summary: "Add a user to a workspace",
  description:
    "Add an existing user to a workspace with a role. They start with access to every project. Returns the updated member list. Requires the `workspaces:manage` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("workspaces:manage"),
  ] as const,
  request: {
    params: adminWorkspaceParam,
    body: {
      required: true,
      content: { "application/json": { schema: addAdminWorkspaceMemberBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "Updated workspace members",
      adminWorkspaceMemberListSchema,
    ),
    400: errorResponse("Unknown role, or the owner role was requested"),
    403: forbidden,
    404: errorResponse("Workspace or user not found"),
    409: errorResponse("The user is already a member"),
  },
});

const updateWorkspaceMemberRoleRoute = createRoute({
  method: "put",
  operationId: "updateAdminWorkspaceMemberRole",
  path: "/workspaces/{workspaceId}/members/{userId}/role",
  tags: ["Admin"],
  summary: "Change a workspace member's role",
  description:
    "Change a member's role. Use the ownership transfer to make someone the owner; the only owner's role can't be changed. Returns the updated member list. Requires the `workspaces:manage` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("workspaces:manage"),
  ] as const,
  request: {
    params: adminWorkspaceMemberParam,
    body: {
      required: true,
      content: {
        "application/json": { schema: updateAdminWorkspaceMemberRoleBody },
      },
    },
  },
  responses: {
    200: jsonResponse(
      "Updated workspace members",
      adminWorkspaceMemberListSchema,
    ),
    400: errorResponse("Unknown role, or the owner role was requested"),
    403: forbidden,
    404: errorResponse("Workspace or member not found"),
    409: errorResponse("The member is the only owner"),
  },
});

const removeWorkspaceMemberRoute = createRoute({
  method: "delete",
  operationId: "removeAdminWorkspaceMember",
  path: "/workspaces/{workspaceId}/members/{userId}",
  tags: ["Admin"],
  summary: "Remove a workspace member",
  description:
    "Remove a member from a workspace. Their account stays. The only owner can't be removed. Returns the updated member list. Requires the `workspaces:manage` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("workspaces:manage"),
  ] as const,
  request: { params: adminWorkspaceMemberParam },
  responses: {
    200: jsonResponse(
      "Updated workspace members",
      adminWorkspaceMemberListSchema,
    ),
    403: forbidden,
    404: errorResponse("Workspace or member not found"),
    409: errorResponse("The member is the only owner"),
  },
});

const transferWorkspaceOwnershipRoute = createRoute({
  method: "put",
  operationId: "transferAdminWorkspaceOwnership",
  path: "/workspaces/{workspaceId}/owner",
  tags: ["Admin"],
  summary: "Transfer workspace ownership",
  description:
    "Make an existing member the only owner of a workspace, for example when the previous owner has left. Previous owners become admins. Returns the updated member list. Requires the `workspaces:manage` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("workspaces:manage"),
  ] as const,
  request: {
    params: adminWorkspaceParam,
    body: {
      required: true,
      content: {
        "application/json": { schema: transferAdminWorkspaceOwnershipBody },
      },
    },
  },
  responses: {
    200: jsonResponse(
      "Updated workspace members",
      adminWorkspaceMemberListSchema,
    ),
    400: errorResponse("The member is already the only owner"),
    403: forbidden,
    404: errorResponse("Workspace or member not found"),
  },
});

const archiveWorkspaceRoute = createRoute({
  method: "post",
  operationId: "archiveAdminWorkspace",
  path: "/workspaces/{workspaceId}/archive",
  tags: ["Admin"],
  summary: "Archive a workspace",
  description:
    "Disable a workspace without deleting anything. Its members, API keys, MCP clients, public links, calendar feeds, notifications, and integrations stop working, and requests for it return 403 with the code WORKSPACE_ARCHIVED. Open realtime connections are closed. Restore it to undo. Requires the `workspaces:archive` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("workspaces:archive"),
  ] as const,
  request: { params: adminWorkspaceParam },
  responses: {
    200: jsonResponse(
      "The workspace's archive state",
      adminWorkspaceArchiveStateSchema,
    ),
    403: forbidden,
    404: errorResponse("Workspace not found"),
    409: errorResponse(
      "The workspace is already archived (code WORKSPACE_ALREADY_ARCHIVED)",
    ),
  },
});

const restoreWorkspaceRoute = createRoute({
  method: "post",
  operationId: "restoreAdminWorkspace",
  path: "/workspaces/{workspaceId}/restore",
  tags: ["Admin"],
  summary: "Restore an archived workspace",
  description:
    "Make an archived workspace usable again, with all of its data, members, and integrations as they were. Requires the `workspaces:archive` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("workspaces:archive"),
  ] as const,
  request: { params: adminWorkspaceParam },
  responses: {
    200: jsonResponse(
      "The workspace's archive state",
      adminWorkspaceArchiveStateSchema,
    ),
    403: forbidden,
    404: errorResponse("Workspace not found"),
    409: errorResponse(
      "The workspace is not archived (code WORKSPACE_NOT_ARCHIVED)",
    ),
  },
});

const deleteWorkspaceRoute = createRoute({
  method: "delete",
  operationId: "deleteAdminWorkspace",
  path: "/workspaces/{workspaceId}",
  tags: ["Admin"],
  summary: "Delete a workspace",
  description:
    "Permanently delete a workspace and everything in it, archived or not, the same way its owner can: projects, tasks, members, invitations and uploaded files go, and open realtime connections are closed. The administrator does not need to be a member. Requires the `workspaces:delete` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("workspaces:delete"),
  ] as const,
  request: { params: adminWorkspaceParam },
  responses: {
    200: jsonResponse("The deleted workspace", adminDeletedWorkspaceSchema),
    403: forbidden,
    404: errorResponse("Workspace not found"),
    409: errorResponse(
      "The workspace still has an active subscription (code WORKSPACE_HAS_ACTIVE_SUBSCRIPTION)",
    ),
  },
});

const listAuditLogRoute = createRoute({
  method: "get",
  operationId: "listAdminAuditLog",
  path: "/audit-log",
  tags: ["Admin"],
  summary: "List the admin audit log",
  description:
    "Page through recorded administrative actions, newest first, optionally filtered by action or category, actor, or target. Entries never contain passwords, tokens, reset links, or API key values. Requires the `audit:read` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("audit:read"),
  ] as const,
  request: { query: listAdminAuditLogQuery },
  responses: {
    200: jsonResponse("Audit log entries, newest first", adminAuditLogSchema),
    400: errorResponse("Invalid filter, page, or limit"),
    403: forbidden,
  },
});

const getSystemStatusRoute = createRoute({
  method: "get",
  operationId: "getAdminSystemStatus",
  path: "/system",
  tags: ["Admin"],
  summary: "Get system status",
  description:
    "Check this API instance and the services it uses: version, uptime, database, WebSockets, Redis fan-out, SMTP, object storage, sign-in providers and integration providers. Each check gives up after a few seconds, so one unreachable service can't block the response. Only statuses, counts and short error categories are returned, never hosts, credentials or secrets. Requires the `system:read` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("system:read"),
  ] as const,
  responses: {
    200: jsonResponse("Status of this instance", adminSystemStatusSchema),
    403: forbidden,
  },
});

const sendTestEmailRoute = createRoute({
  method: "post",
  operationId: "sendAdminTestEmail",
  path: "/system/test-email",
  tags: ["Admin"],
  summary: "Send a test email",
  description:
    "Send a test email to the calling administrator's own address to check the SMTP settings. There is no recipient parameter. Limited to 5 per administrator every 10 minutes on each API instance. Requires the `system:read` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("system:read"),
  ] as const,
  responses: {
    200: jsonResponse(
      "The mail server accepted the test email",
      adminTestEmailResultSchema,
    ),
    403: forbidden,
    409: errorResponse("SMTP is not configured on this instance"),
    429: errorResponse("Too many test emails; retry after Retry-After seconds"),
    502: errorResponse("The mail server did not accept the test email"),
  },
});

const getOverviewRoute = createRoute({
  method: "get",
  operationId: "getAdminOverview",
  path: "/overview",
  tags: ["Admin"],
  summary: "Get the administration overview",
  description:
    "User and workspace counts, the five newest users and administrative actions, compact service checks, and configuration warnings. Activity is based on session refreshes within 30 days and excludes deactivated accounts. Requires all four instance permissions: `users:read`, `workspaces:read`, `audit:read`, and `system:read`; API keys are rejected. No credentials or audit metadata are returned.",
  middleware: [
    requireUserSession,
    requireInstancePermission(
      "users:read",
      "workspaces:read",
      "audit:read",
      "system:read",
    ),
  ] as const,
  responses: {
    200: jsonResponse("Instance overview", adminOverviewSchema),
    401: errorResponse("Authentication required"),
    403: forbidden,
  },
});

const admin = apiRouter()
  .openapi(getOverviewRoute, async (c) => c.json(await getOverview(), 200))
  .openapi(getAccessRoute, async (c) => {
    const { permissions } = await getUserAccess(c.get("userId"));
    return c.json({ permissions }, 200);
  })
  .openapi(listUsersRoute, async (c) =>
    c.json(await listUsers(c.req.valid("query")), 200),
  )
  .openapi(listWorkspacesRoute, async (c) =>
    c.json(await listWorkspaces(c.req.valid("query")), 200),
  )
  .openapi(listWorkspaceMembersRoute, async (c) =>
    c.json(await listWorkspaceMembers(c.req.valid("param").workspaceId), 200),
  )
  .openapi(listWorkspaceRolesRoute, async (c) =>
    c.json(await listWorkspaceRoles(c.req.valid("param").workspaceId), 200),
  )
  .openapi(addWorkspaceMemberRoute, async (c) =>
    c.json(
      await addWorkspaceMember(
        {
          workspaceId: c.req.valid("param").workspaceId,
          ...c.req.valid("json"),
        },
        adminAuditRequest(c),
      ),
      200,
    ),
  )
  .openapi(updateWorkspaceMemberRoleRoute, async (c) =>
    c.json(
      await updateWorkspaceMemberRole(
        { ...c.req.valid("param"), role: c.req.valid("json").role },
        adminAuditRequest(c),
      ),
      200,
    ),
  )
  .openapi(removeWorkspaceMemberRoute, async (c) =>
    c.json(
      await removeWorkspaceMember(c.req.valid("param"), adminAuditRequest(c)),
      200,
    ),
  )
  .openapi(getSystemStatusRoute, async (c) =>
    c.json(await getSystemStatus(), 200),
  )
  .openapi(sendTestEmailRoute, async (c) =>
    c.json(
      await sendAdminTestEmail(
        { userId: c.get("userId"), email: c.get("userEmail") },
        adminAuditRequest(c),
      ),
      200,
    ),
  )
  .openapi(transferWorkspaceOwnershipRoute, async (c) =>
    c.json(
      await transferWorkspaceOwnership(
        {
          workspaceId: c.req.valid("param").workspaceId,
          userId: c.req.valid("json").userId,
        },
        adminAuditRequest(c),
      ),
      200,
    ),
  )
  .openapi(archiveWorkspaceRoute, async (c) =>
    c.json(
      await archiveWorkspace(
        c.req.valid("param").workspaceId,
        adminAuditRequest(c),
      ),
      200,
    ),
  )
  .openapi(restoreWorkspaceRoute, async (c) =>
    c.json(
      await restoreWorkspace(
        c.req.valid("param").workspaceId,
        adminAuditRequest(c),
      ),
      200,
    ),
  )
  .openapi(deleteWorkspaceRoute, async (c) =>
    c.json(
      await deleteWorkspace(
        c.req.valid("param").workspaceId,
        adminAuditRequest(c),
      ),
      200,
    ),
  )
  .openapi(listAuditLogRoute, async (c) =>
    c.json(await listAuditLog(c.req.valid("query")), 200),
  )
  .route("/users", adminUserRoutes)
  .route("/users", adminUserAccountRoutes)
  .route("/roles", adminRoleRoutes)
  .route("/settings", adminSettingsRoutes)
  .route("/", adminUserSecurityRoutes);

export default admin;

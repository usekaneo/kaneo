import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireInstanceAdmin } from "../utils/require-instance-admin";
import { requireUserSession } from "../utils/require-user-session";
import addWorkspaceMember from "./controllers/add-workspace-member";
import listUsers from "./controllers/list-users";
import listWorkspaceMembers from "./controllers/list-workspace-members";
import listWorkspaceRoles from "./controllers/list-workspace-roles";
import listWorkspaces from "./controllers/list-workspaces";
import removeWorkspaceMember from "./controllers/remove-workspace-member";
import transferWorkspaceOwnership from "./controllers/transfer-workspace-ownership";
import updateWorkspaceMemberRole from "./controllers/update-workspace-member-role";
import {
  adminUserListSchema,
  adminWorkspaceListSchema,
  adminWorkspaceMemberListSchema,
  adminWorkspaceRoleListSchema,
} from "./response";
import {
  addAdminWorkspaceMemberBody,
  adminWorkspaceMemberParam,
  adminWorkspaceParam,
  listAdminUsersQuery,
  listAdminWorkspacesQuery,
  transferAdminWorkspaceOwnershipBody,
  updateAdminWorkspaceMemberRoleBody,
} from "./schema";

const forbidden = errorResponse(
  "The caller is not an instance administrator or is authenticated with an API key",
);

const listUsersRoute = createRoute({
  method: "get",
  operationId: "listAdminUsers",
  path: "/users",
  tags: ["Admin"],
  summary: "List instance users",
  description:
    "Page through every user account on this instance, optionally filtered by a case-insensitive name or email search. Requires an instance administrator session; API keys are rejected.",
  middleware: [requireUserSession, requireInstanceAdmin] as const,
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
    "Page through every workspace on this instance with its owners, member count and project count, optionally filtered by a case-insensitive name or slug search. Requires an instance administrator session; API keys are rejected.",
  middleware: [requireUserSession, requireInstanceAdmin] as const,
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
    "List every member of a workspace with their role, whether or not the administrator belongs to it.",
  middleware: [requireUserSession, requireInstanceAdmin] as const,
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
    "List the roles an administrator can give members of a workspace: the built-in viewer, member and admin roles plus the workspace's custom roles. Ownership is changed with the ownership transfer instead.",
  middleware: [requireUserSession, requireInstanceAdmin] as const,
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
    "Add an existing user to a workspace with a role. They start with access to every project. Returns the updated member list.",
  middleware: [requireUserSession, requireInstanceAdmin] as const,
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
    "Change a member's role. Use the ownership transfer to make someone the owner; the only owner's role can't be changed. Returns the updated member list.",
  middleware: [requireUserSession, requireInstanceAdmin] as const,
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
    "Remove a member from a workspace. Their account stays. The only owner can't be removed. Returns the updated member list.",
  middleware: [requireUserSession, requireInstanceAdmin] as const,
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
    "Make an existing member the only owner of a workspace, for example when the previous owner has left. Previous owners become admins. Returns the updated member list.",
  middleware: [requireUserSession, requireInstanceAdmin] as const,
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

const admin = apiRouter()
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
      await addWorkspaceMember({
        workspaceId: c.req.valid("param").workspaceId,
        ...c.req.valid("json"),
      }),
      200,
    ),
  )
  .openapi(updateWorkspaceMemberRoleRoute, async (c) =>
    c.json(
      await updateWorkspaceMemberRole({
        ...c.req.valid("param"),
        role: c.req.valid("json").role,
      }),
      200,
    ),
  )
  .openapi(removeWorkspaceMemberRoute, async (c) =>
    c.json(await removeWorkspaceMember(c.req.valid("param")), 200),
  )
  .openapi(transferWorkspaceOwnershipRoute, async (c) =>
    c.json(
      await transferWorkspaceOwnership({
        workspaceId: c.req.valid("param").workspaceId,
        userId: c.req.valid("json").userId,
      }),
      200,
    ),
  );

export default admin;

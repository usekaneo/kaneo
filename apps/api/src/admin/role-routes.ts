import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireUserSession } from "../utils/require-user-session";
import { adminAuditRequest } from "./audit/admin-audit-request";
import createInstanceRole from "./controllers/create-instance-role";
import deleteInstanceRole from "./controllers/delete-instance-role";
import listInstanceRoles from "./controllers/list-instance-roles";
import updateInstanceRole from "./controllers/update-instance-role";
import { requireInstancePermission } from "./roles/require-instance-permission";
import {
  deletedInstanceRoleSchema,
  instanceRoleBody,
  instanceRoleListSchema,
  instanceRoleParam,
  instanceRoleSchema,
} from "./roles/schema";

const forbidden = errorResponse(
  "The caller lacks the instance permission or used an API key",
);
const roleBody = {
  required: true,
  content: { "application/json": { schema: instanceRoleBody } },
};

const listRolesRoute = createRoute({
  method: "get",
  operationId: "listInstanceRoles",
  path: "/",
  tags: ["Admin"],
  summary: "List custom instance roles",
  description:
    "List the custom instance roles with their permissions and how many users have each. The built-in `admin` (every permission) and `user` (none) roles are not listed. Requires the `users:read` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("users:read"),
  ] as const,
  responses: {
    200: jsonResponse("Custom instance roles by name", instanceRoleListSchema),
    403: forbidden,
  },
});

const createRoleRoute = createRoute({
  method: "post",
  operationId: "createInstanceRole",
  path: "/",
  tags: ["Admin"],
  summary: "Create a custom instance role",
  description:
    "Create a role that grants a set of instance permissions. Assign it to users by name. Requires the `roles:manage` permission, which only the built-in `admin` role has; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("roles:manage"),
  ] as const,
  request: { body: roleBody },
  responses: {
    201: jsonResponse("The new role", instanceRoleSchema),
    400: errorResponse("Invalid name or permission"),
    403: forbidden,
    409: errorResponse("The name is taken, reserved, or already held by users"),
  },
});

const updateRoleRoute = createRoute({
  method: "put",
  operationId: "updateInstanceRole",
  path: "/{roleId}",
  tags: ["Admin"],
  summary: "Update a custom instance role",
  description:
    "Rename a role or replace its permissions. Users who have it keep it under the new name, and permission changes apply to their next request. Requires the `roles:manage` permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("roles:manage"),
  ] as const,
  request: { params: instanceRoleParam, body: roleBody },
  responses: {
    200: jsonResponse("The updated role", instanceRoleSchema),
    400: errorResponse("Invalid name or permission"),
    403: forbidden,
    404: errorResponse("Role not found"),
    409: errorResponse("The name is taken, reserved, or already held by users"),
  },
});

const deleteRoleRoute = createRoute({
  method: "delete",
  operationId: "deleteInstanceRole",
  path: "/{roleId}",
  tags: ["Admin"],
  summary: "Delete a custom instance role",
  description:
    "Delete a role that no user has. Requires the `roles:manage` permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("roles:manage"),
  ] as const,
  request: { params: instanceRoleParam },
  responses: {
    200: jsonResponse("The deleted role", deletedInstanceRoleSchema),
    403: forbidden,
    404: errorResponse("Role not found"),
    409: errorResponse("Users still have this role (code ROLE_IN_USE)"),
  },
});

const adminRoleRoutes = apiRouter()
  .openapi(listRolesRoute, async (c) => c.json(await listInstanceRoles(), 200))
  .openapi(createRoleRoute, async (c) =>
    c.json(
      await createInstanceRole(c.req.valid("json"), adminAuditRequest(c)),
      201,
    ),
  )
  .openapi(updateRoleRoute, async (c) =>
    c.json(
      await updateInstanceRole(
        c.req.valid("param").roleId,
        c.req.valid("json"),
        adminAuditRequest(c),
      ),
      200,
    ),
  )
  .openapi(deleteRoleRoute, async (c) =>
    c.json(
      await deleteInstanceRole(
        c.req.valid("param").roleId,
        adminAuditRequest(c),
      ),
      200,
    ),
  );

export default adminRoleRoutes;

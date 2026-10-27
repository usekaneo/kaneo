import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireUserSession } from "../utils/require-user-session";
import { adminAuditRequest } from "./audit/admin-audit-request";
import deactivateUser from "./controllers/deactivate-user";
import deleteUser from "./controllers/delete-user";
import reactivateUser from "./controllers/reactivate-user";
import updateUser from "./controllers/update-user";
import { adminDeletedUserSchema, adminUserSchema } from "./response";
import { requireInstancePermission } from "./roles/require-instance-permission";
import { requireManageableUser } from "./roles/require-manageable-user";
import { adminUserParam, updateAdminUserBody } from "./schema";

const forbidden = errorResponse(
  "The caller lacks the instance permission, the user has permissions the caller lacks, or the request used an API key",
);
const notFound = errorResponse("User not found");

const updateUserRoute = createRoute({
  method: "patch",
  operationId: "updateAdminUser",
  path: "/{userId}",
  tags: ["Admin"],
  summary: "Update a user",
  description:
    "Change a user's name, email, or instance role. A new email must be verified again. You can't change your own role or remove the last administrator. Requires the `users:update` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("users:update"),
    requireManageableUser,
  ] as const,
  request: {
    params: adminUserParam,
    body: {
      required: true,
      content: { "application/json": { schema: updateAdminUserBody } },
    },
  },
  responses: {
    200: jsonResponse("The updated user", adminUserSchema),
    400: errorResponse(
      "Invalid fields, an unknown role, your own role, or the last administrator",
    ),
    403: forbidden,
    404: notFound,
    409: errorResponse("Another user has this email address"),
  },
});

const deactivateUserRoute = createRoute({
  method: "post",
  operationId: "deactivateAdminUser",
  path: "/{userId}/deactivate",
  tags: ["Admin"],
  summary: "Deactivate a user",
  description:
    "Block a user from signing in and end all of their sessions. Their data stays. Requires the `users:disable` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("users:disable"),
    requireManageableUser,
  ] as const,
  request: { params: adminUserParam },
  responses: {
    200: jsonResponse("The deactivated user", adminUserSchema),
    400: errorResponse("You can't deactivate yourself"),
    403: forbidden,
    404: notFound,
  },
});

const reactivateUserRoute = createRoute({
  method: "post",
  operationId: "reactivateAdminUser",
  path: "/{userId}/reactivate",
  tags: ["Admin"],
  summary: "Reactivate a user",
  description:
    "Let a deactivated user sign in again. Requires the `users:disable` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("users:disable"),
    requireManageableUser,
  ] as const,
  request: { params: adminUserParam },
  responses: {
    200: jsonResponse("The reactivated user", adminUserSchema),
    403: forbidden,
    404: notFound,
  },
});

const deleteUserRoute = createRoute({
  method: "delete",
  operationId: "deleteAdminUser",
  path: "/{userId}",
  tags: ["Admin"],
  summary: "Delete a user",
  description:
    "Permanently delete a user's account, the same way they could themselves: workspaces where they are the only member are deleted, and they leave the others. Fails while they are the only owner of a workspace with other members. Requires the `users:delete` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("users:delete"),
    requireManageableUser,
  ] as const,
  request: { params: adminUserParam },
  responses: {
    200: jsonResponse("The deleted user", adminDeletedUserSchema),
    400: errorResponse("You can't delete yourself"),
    403: forbidden,
    404: notFound,
    409: errorResponse(
      "The user is the only owner of a shared workspace, or one of their workspaces has an active subscription",
    ),
  },
});

const adminUserAccountRoutes = apiRouter()
  .openapi(updateUserRoute, async (c) =>
    c.json(
      await updateUser(
        {
          userId: c.req.valid("param").userId,
          actorId: c.get("userId"),
          ...c.req.valid("json"),
        },
        adminAuditRequest(c),
      ),
      200,
    ),
  )
  .openapi(deactivateUserRoute, async (c) =>
    c.json(
      await deactivateUser(
        c.req.valid("param").userId,
        c.get("userId"),
        adminAuditRequest(c),
      ),
      200,
    ),
  )
  .openapi(reactivateUserRoute, async (c) =>
    c.json(
      await reactivateUser(c.req.valid("param").userId, adminAuditRequest(c)),
      200,
    ),
  )
  .openapi(deleteUserRoute, async (c) =>
    c.json(
      await deleteUser(
        c.req.valid("param").userId,
        c.get("userId"),
        adminAuditRequest(c),
      ),
      200,
    ),
  );

export default adminUserAccountRoutes;

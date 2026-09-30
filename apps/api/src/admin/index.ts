import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireInstanceAdmin } from "../utils/require-instance-admin";
import { requireUserSession } from "../utils/require-user-session";
import listUsers from "./controllers/list-users";
import { adminUserListSchema } from "./response";
import { listAdminUsersQuery } from "./schema";

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
    403: errorResponse(
      "The caller is not an instance administrator or is authenticated with an API key",
    ),
  },
});

const admin = apiRouter().openapi(listUsersRoute, async (c) =>
  c.json(await listUsers(c.req.valid("query")), 200),
);

export default admin;

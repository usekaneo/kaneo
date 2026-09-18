import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import getMyPermissions from "./controllers/get-my-permissions";
import getWorkspaceMembersCtrl from "./controllers/get-workspace-members";
import { myPermissionsSchema, workspaceMemberListSchema } from "./response";
import { workspaceIdParam } from "./schema";

const getWorkspaceMembersRoute = createRoute({
  method: "get",
  operationId: "getWorkspaceMembers",
  path: "/{workspaceId}/members",
  tags: ["Workspaces"],
  summary: "Get workspace members",
  description: "Get all members of a workspace, with their role.",
  middleware: [workspaceAccess.fromParam("workspaceId")] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("List of workspace members", workspaceMemberListSchema),
    400: errorResponse("Workspace ID could not be determined"),
    403: errorResponse("No access to the workspace"),
  },
});

const getMyPermissionsRoute = createRoute({
  method: "get",
  operationId: "getMyWorkspacePermissions",
  path: "/{workspaceId}/permissions",
  tags: ["Workspaces"],
  summary: "Get my permissions",
  description:
    "Every action the caller may take in the workspace, by resource. For showing and hiding UI; the API still checks each request.",
  middleware: [workspaceAccess.fromParam("workspaceId")] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("Granted actions by resource", myPermissionsSchema),
    403: errorResponse("No access to the workspace"),
  },
});

const workspace = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(getWorkspaceMembersRoute, async (c) =>
    c.json(await getWorkspaceMembersCtrl(c.get("workspaceId")), 200),
  )
  .openapi(getMyPermissionsRoute, async (c) =>
    c.json(await getMyPermissions(c, c.get("workspaceId")), 200),
  );

export default workspace;

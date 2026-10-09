import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { listWorkspaceProjectAccess } from "../project-access/list-workspace-project-access";
import {
  requireApiKeyScope,
  requireWorkspacePermission,
} from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import getMyProjectAccessCtrl from "./controllers/get-my-project-access";
import getWorkspaceCtrl from "./controllers/get-workspace";
import getWorkspaceMembersCtrl from "./controllers/get-workspace-members";
import listWorkspacesCtrl from "./controllers/list-workspaces";
import updateMemberProjectAccessCtrl from "./controllers/update-member-project-access";
import {
  memberProjectAccessListSchema,
  memberProjectAccessSchema,
  workspaceListSchema,
  workspaceMemberListSchema,
  workspaceSchema,
} from "./response";
import {
  updateMemberProjectAccessBody,
  workspaceIdParam,
  workspaceMemberParam,
  workspaceMembersQuery,
} from "./schema";

const listWorkspacesRoute = createRoute({
  method: "get",
  operationId: "listWorkspaces",
  path: "/",
  tags: ["Workspaces"],
  summary: "List workspaces",
  description:
    "List the workspaces where one of the caller's roles grants workspace:read, with the caller's role, sorted by name. Instance admins get every workspace they are a member of, and only those.",
  middleware: [requireApiKeyScope({ workspace: ["read"] })] as const,
  responses: {
    200: jsonResponse("The caller's workspaces", workspaceListSchema),
    403: errorResponse("The API key lacks workspace:read"),
  },
});

const getWorkspaceRoute = createRoute({
  method: "get",
  operationId: "getWorkspace",
  path: "/{workspaceId}",
  tags: ["Workspaces"],
  summary: "Get workspace",
  description:
    "Get a workspace where one of the caller's roles grants workspace:read, with the caller's role. Instance admins can get any workspace, with a null role when they are not a member.",
  middleware: [requireApiKeyScope({ workspace: ["read"] })] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("The workspace", workspaceSchema),
    403: errorResponse("The API key lacks workspace:read"),
    404: errorResponse(
      "Workspace not found, the caller is not a member of it, or none of their roles grants workspace:read",
    ),
  },
});

const getWorkspaceMembersRoute = createRoute({
  method: "get",
  operationId: "getWorkspaceMembers",
  path: "/{workspaceId}/members",
  tags: ["Workspaces"],
  summary: "Get workspace members",
  description:
    "Get all members of a workspace, with their role. Pass projectId to get only the members who can access that project.",
  middleware: [workspaceAccess.fromParam("workspaceId")] as const,
  request: { params: workspaceIdParam, query: workspaceMembersQuery },
  responses: {
    200: jsonResponse("List of workspace members", workspaceMemberListSchema),
    403: errorResponse("No access to the project"),
    404: errorResponse(
      "Workspace not found, or project not found in this workspace",
    ),
  },
});

const getWorkspaceProjectAccessRoute = createRoute({
  method: "get",
  operationId: "getWorkspaceProjectAccess",
  path: "/{workspaceId}/project-access",
  tags: ["Workspaces"],
  summary: "Get member project access",
  description:
    "List the members who are limited to selected projects, with the projects each one can access. Everyone else in the workspace can access every project. A caller whose own access is limited only sees the projects they can access.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ member: ["update"] }),
  ] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse(
      "Members limited to selected projects",
      memberProjectAccessListSchema,
    ),
    403: errorResponse("Missing member:update permission"),
    404: errorResponse("Workspace not found"),
  },
});

const getMyProjectAccessRoute = createRoute({
  method: "get",
  operationId: "getMyProjectAccess",
  path: "/{workspaceId}/project-access/me",
  tags: ["Workspaces"],
  summary: "Get my project access",
  description:
    "Get the caller's own project access in the workspace: every project, or the selected projects they're limited to. Owners and instance admins always get every project.",
  middleware: [workspaceAccess.fromParam("workspaceId")] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("The caller's project access", memberProjectAccessSchema),
    404: errorResponse("Workspace not found"),
  },
});

const updateMemberProjectAccessRoute = createRoute({
  method: "put",
  operationId: "updateMemberProjectAccess",
  path: "/{workspaceId}/members/{userId}/project-access",
  tags: ["Workspaces"],
  summary: "Update member project access",
  description:
    "Give a member access to every project, or limit them to selected projects. Owners always access every project, and you can't change your own access or give access to projects you can't access yourself.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    requireWorkspacePermission({ member: ["update"] }),
  ] as const,
  request: {
    params: workspaceMemberParam,
    body: {
      required: true,
      content: {
        "application/json": { schema: updateMemberProjectAccessBody },
      },
    },
  },
  responses: {
    200: jsonResponse("The member's project access", memberProjectAccessSchema),
    400: errorResponse(
      "Invalid body, the member is an owner, or a project is not in this workspace",
    ),
    403: errorResponse(
      "Missing member:update permission, changing your own access, or granting a project you can't access",
    ),
    404: errorResponse("Workspace or member not found"),
  },
});

const workspace = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(listWorkspacesRoute, async (c) =>
    c.json(await listWorkspacesCtrl(c.get("userId")), 200),
  )
  .openapi(getWorkspaceRoute, async (c) =>
    c.json(
      await getWorkspaceCtrl(c.req.valid("param").workspaceId, c.get("userId")),
      200,
    ),
  )
  .openapi(getWorkspaceMembersRoute, async (c) =>
    c.json(
      await getWorkspaceMembersCtrl({
        workspaceId: c.get("workspaceId"),
        userId: c.get("userId"),
        projectId: c.req.valid("query").projectId,
      }),
      200,
    ),
  )
  .openapi(getMyProjectAccessRoute, async (c) =>
    c.json(
      await getMyProjectAccessCtrl(c.get("workspaceId"), c.get("userId")),
      200,
    ),
  )
  .openapi(getWorkspaceProjectAccessRoute, async (c) =>
    c.json(
      await listWorkspaceProjectAccess(c.get("workspaceId"), c.get("userId")),
      200,
    ),
  )
  .openapi(updateMemberProjectAccessRoute, async (c) => {
    const { userId } = c.req.valid("param");
    const body = c.req.valid("json");
    return c.json(
      await updateMemberProjectAccessCtrl({
        workspaceId: c.get("workspaceId"),
        actorId: c.get("userId"),
        userId,
        projectAccess: body.projectAccess,
        projectIds: body.projectIds,
      }),
      200,
    );
  });

export default workspace;

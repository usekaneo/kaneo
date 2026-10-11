import { requireEntitlement } from "../billing/require-entitlement-middleware";
import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import getImportRun from "./controllers/get-import-run";
import listImportRuns from "./controllers/list-import-runs";
import listSourceProjects from "./controllers/list-source-projects";
import getTrelloAuthorizeUrl from "./controllers/get-trello-authorize-url";
import startImportRun from "./controllers/start-import-run";
import {
  importRunEnvelopeSchema,
  importRunListSchema,
  importSourceProjectListSchema,
  trelloAuthorizeUrlSchema,
} from "./response";
import {
  importRunParam,
  listImportSourceProjectsBody,
  startImportRunBody,
  workspaceIdParam,
} from "./schema";

const importPermission = requireWorkspacePermission({
  workspace: ["manage_settings"],
  project: ["create"],
});

const forbidden = errorResponse(
  "Missing workspace:manage_settings or project:create permission",
);

const listImportSourceProjectsRoute = createRoute({
  method: "post",
  operationId: "listImportSourceProjects",
  path: "/projects",
  tags: ["Import"],
  summary: "List projects in an import source",
  description:
    "Sign in to PLANKA, Plane, Linear, Trello or another Kaneo instance and list the projects that can be imported. The credentials are used only for this request; they are never stored, logged, or returned.",
  middleware: [
    workspaceAccess.fromBody(),
    importPermission,
    requireEntitlement,
  ] as const,
  request: {
    body: {
      required: true,
      content: {
        "application/json": { schema: listImportSourceProjectsBody },
      },
    },
  },
  responses: {
    200: jsonResponse(
      "Projects available in the source",
      importSourceProjectListSchema,
    ),
    400: errorResponse(
      "Invalid body, credentials the source rejected, or a destination this server may not reach",
    ),
    402: errorResponse("Workspace plan has expired"),
    403: forbidden,
    404: errorResponse("Workspace not found"),
    502: errorResponse(
      "The source could not be reached or answered with an error",
    ),
  },
});

const startImportRunRoute = createRoute({
  method: "post",
  operationId: "startImportRun",
  path: "/runs",
  tags: ["Import"],
  summary: "Start an import",
  description:
    "Import the selected source projects into the workspace as new Kaneo projects. The import runs in the background; poll getImportRun for progress. The credentials are held in memory only while the import runs; they are never stored, logged, or returned. Imported tasks do not send notifications or trigger integrations.",
  middleware: [
    workspaceAccess.fromBody(),
    importPermission,
    requireEntitlement,
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: startImportRunBody } },
    },
  },
  responses: {
    202: jsonResponse("The import started", importRunEnvelopeSchema),
    400: errorResponse(
      "Invalid body, credentials the source rejected, a destination this server may not reach, or a selected project the source no longer lists",
    ),
    402: errorResponse("Workspace plan has expired"),
    403: forbidden,
    404: errorResponse("Workspace not found"),
    409: errorResponse("Another import is already running in this workspace"),
    429: errorResponse(
      "This server is already running its maximum number of imports, or the API key exceeded its rate limit",
    ),
    502: errorResponse(
      "The source could not be reached or answered with an error",
    ),
    503: errorResponse("The server is restarting and not starting new imports"),
  },
});

const listImportRunsRoute = createRoute({
  method: "get",
  operationId: "listImportRuns",
  path: "/runs/{workspaceId}",
  tags: ["Import"],
  summary: "List imports",
  description:
    "The workspace's 20 most recent imports, newest first. A run whose server stopped reporting progress is returned as failed.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    importPermission,
  ] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("Recent imports", importRunListSchema),
    403: forbidden,
    404: errorResponse("Workspace not found"),
  },
});

const getImportRunRoute = createRoute({
  method: "get",
  operationId: "getImportRun",
  path: "/runs/{workspaceId}/{runId}",
  tags: ["Import"],
  summary: "Get an import",
  description:
    "Progress and outcome of one import, including each project's status, counts and warnings.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    importPermission,
  ] as const,
  request: { params: importRunParam },
  responses: {
    200: jsonResponse("The import", importRunEnvelopeSchema),
    403: forbidden,
    404: errorResponse("Workspace or import not found"),
  },
});

const getTrelloAuthorizeUrlRoute = createRoute({
  method: "get",
  operationId: "getTrelloAuthorizeUrl",
  path: "/trello/authorize-url/{workspaceId}",
  tags: ["Import"],
  summary: "Get the Trello authorize link",
  description:
    "Link to Trello's authorize page for this server's Trello app, where the user approves read access and copies a token for startImportRun. null when the server has no TRELLO_API_KEY.",
  middleware: [
    workspaceAccess.fromParam("workspaceId"),
    importPermission,
  ] as const,
  request: { params: workspaceIdParam },
  responses: {
    200: jsonResponse("The Trello authorize link", trelloAuthorizeUrlSchema),
    403: forbidden,
    404: errorResponse("Workspace not found"),
  },
});

const importRoutes = apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(listImportSourceProjectsRoute, async (c) => {
    const { connection } = c.req.valid("json");
    return c.json(await listSourceProjects(connection), 200);
  })
  .openapi(startImportRunRoute, async (c) => {
    const { connection, projectIds, includeComments } = c.req.valid("json");
    const run = await startImportRun({
      workspaceId: c.get("workspaceId"),
      userId: c.get("userId"),
      connection,
      projectIds,
      includeComments,
    });
    return c.json({ run }, 202);
  })
  .openapi(listImportRunsRoute, async (c) =>
    c.json(await listImportRuns(c.get("workspaceId")), 200),
  )
  .openapi(getTrelloAuthorizeUrlRoute, async (c) =>
    c.json(getTrelloAuthorizeUrl(), 200),
  )
  .openapi(getImportRunRoute, async (c) => {
    const { runId } = c.req.valid("param");
    return c.json(await getImportRun(c.get("workspaceId"), runId), 200);
  });

export default importRoutes;

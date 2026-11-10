import jobs from "./jobs/routes";
import links from "./links";
import sharedTeams from "./teams";
import { brandText } from "@kaneo/branding";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
  type BaseVariables,
} from "../openapi";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { settings } from "../database/quills/schema/auth";
import { withQuillsRequest } from "./with-quills-request";

const route = createRoute({
  method: "get",
  operationId: "getQuillsWorkspaceContext",
  path: "/{workspaceId}/context",
  tags: ["Quills"],
  summary: "Get the caller's Quills workspace context",
  description: brandText(
    "Uses the existing Kaneo account, workspace membership, roles and API-key scope. Initializes Quills defaults and the caller's actor when needed. Requires workspace:read and quills:read.",
  ),
  middleware: [workspaceAccess.fromParam("workspaceId")] as const,
  request: { params: z.object({ workspaceId: z.string().min(1) }) },
  responses: {
    200: jsonResponse(
      "Workspace and actor for Quills features",
      z
        .object({
          workspace: z.object({
            id: z.string(),
            name: z.string(),
            slug: z.string(),
          }),
          actor: z.object({
            principalId: z.string(),
            userId: z.string(),
            workspaceId: z.string(),
          }),
        })
        .openapi("QuillsWorkspaceContext"),
    ),
    401: errorResponse("Authentication required"),
    403: errorResponse(
      "Workspace archived or insufficient permission or API-key scope",
    ),
    404: errorResponse("Workspace not found"),
  },
});

export default apiRouter<BaseVariables & { workspaceId: string }>()
  .route("/", jobs)
  .route("/", links)
  .route("/", sharedTeams)
  .openapi(route, async (c) => {
    const result = await withQuillsRequest(
      c,
      { action: "read" },
      async (db, actor) => {
        const [workspace] = await db
          .select({ name: settings.name, slug: settings.slug })
          .from(settings);
        if (!workspace) throw new Error("Quills workspace was not initialized");
        return { workspace: { id: actor.workspaceId, ...workspace }, actor };
      },
    );
    return c.json(result, 200);
  });

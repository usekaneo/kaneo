import {
  apiRouter,
  type BaseVariables,
  createRoute,
  errorResponse,
  jsonResponse,
  z,
} from "../openapi";
import { readSyncRules } from "../plugins/sync/rules";
import db from "../database";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import { getSyncIntegration } from "./controllers/get-integration";
import { getAuthorizedSyncProject } from "./controllers/authorized-project";
import { previewSyncRules } from "./controllers/preview-rules";
import { resumeSync } from "./controllers/resume-sync";
import { reviewSyncResume } from "./controllers/review-resume";
import { saveSyncRules } from "./controllers/save-rules";
import {
  resumeBody,
  resumeParams,
  resumePreviewSchema,
  rulesBody,
  saveRulesBody,
  syncParams,
  syncPreviewSchema,
} from "./schema";

const access = [
  workspaceAccess.fromProject("projectId"),
  requireWorkspacePermission({ project: ["read"], task: ["read"] }),
];
const manage = [
  ...access,
  requireWorkspacePermission({ workspace: ["manage_settings"] }),
];
const errors = {
  400: errorResponse("Invalid rule or workspace label"),
  403: errorResponse(
    "No access to the project, or missing required permission",
  ),
  404: errorResponse("Project, integration, or linked task not found"),
  409: errorResponse(
    "Configuration, impact or comparison changed; review again",
  ),
};
const path = "/project/{projectId}/{provider}";
const body = <T extends z.ZodType>(schema: T) => ({
  required: true as const,
  content: { "application/json": { schema } },
});

const getRoute = createRoute({
  method: "get",
  path,
  operationId: "getIntegrationSyncRules",
  tags: ["Integration sync"],
  summary: "Get sync rules and current task scope",
  description:
    "Workspace members with project and task read permissions can inspect saved rules. Rules remain active when advanced mode is hidden. Paused issue links are preserved; eligible paused tasks require review before resuming.",
  middleware: access,
  request: {
    params: syncParams,
    query: z.object({ after: z.string().optional() }),
  },
  responses: {
    200: jsonResponse("Saved rules and scope", syncPreviewSchema),
    ...errors,
  },
});
const previewRoute = createRoute({
  method: "post",
  path: `${path}/preview`,
  operationId: "previewIntegrationSyncRules",
  tags: ["Integration sync"],
  summary: "Preview a sync rule change",
  description:
    "Returns matching tasks, new exports, paused links and a token bound to the current integration and impact. Outgoing labels are workspace label IDs; incoming labels are exact repository label names.",
  middleware: manage,
  request: { params: syncParams, body: body(rulesBody) },
  responses: {
    200: jsonResponse("Proposed rule impact", syncPreviewSchema),
    ...errors,
  },
});
const saveRoute = createRoute({
  method: "patch",
  path,
  operationId: "saveIntegrationSyncRules",
  tags: ["Integration sync"],
  summary: "Apply a previewed sync rule",
  description:
    "Save shared integration rules only if the preview is still current. Excluded links are paused, never deleted. Newly matching unlinked tasks are exported through the integration event path. Paused links require explicit review to resume.",
  middleware: manage,
  request: { params: syncParams, body: body(saveRulesBody) },
  responses: {
    200: jsonResponse("Saved rules and current scope", syncPreviewSchema),
    ...errors,
  },
});
const reviewRoute = createRoute({
  method: "get",
  path: `${path}/links/{linkId}/review`,
  operationId: "reviewIntegrationSyncResume",
  tags: ["Integration sync"],
  summary: "Compare a paused task with its external issue",
  middleware: manage,
  request: { params: resumeParams },
  responses: {
    200: jsonResponse(
      "Current values and comparison token",
      resumePreviewSchema,
    ),
    ...errors,
    502: errorResponse("External issue unavailable; sync remains paused"),
  },
});
const resumeRoute = createRoute({
  method: "post",
  path: `${path}/links/{linkId}/resume`,
  operationId: "resumeIntegrationSync",
  tags: ["Integration sync"],
  summary: "Resume a reviewed issue link",
  description:
    "Explicitly choose the current Kaneo or repository title, description and open/closed state. Existing links are reused; historical comments are not replayed. The task must still match its outgoing rule. A changed comparison requires another review.",
  middleware: [...manage, requireWorkspacePermission({ task: ["update"] })],
  request: { params: resumeParams, body: body(resumeBody) },
  responses: {
    200: jsonResponse("Sync resumed", z.object({ success: z.boolean() })),
    ...errors,
    409: errorResponse(
      "Comparison changed or synchronization is busy; review or retry",
    ),
    502: errorResponse("External issue unavailable; sync remains paused"),
  },
});

export default apiRouter<BaseVariables & { workspaceId: string }>()
  .openapi(getRoute, async (c) => {
    const { projectId, provider } = c.req.valid("param");
    return c.json(
      await db.transaction(async (tx) => {
        await getAuthorizedSyncProject(
          projectId,
          c.get("workspaceId"),
          tx,
          true,
        );
        const integration = await getSyncIntegration(projectId, provider, tx);
        return previewSyncRules(
          integration,
          readSyncRules(integration.config)!,
          tx,
          c.req.valid("query").after,
        );
      }),
      200,
    );
  })
  .openapi(previewRoute, async (c) => {
    const { projectId, provider } = c.req.valid("param");
    return c.json(
      await db.transaction(async (tx) => {
        await getAuthorizedSyncProject(
          projectId,
          c.get("workspaceId"),
          tx,
          true,
        );
        return previewSyncRules(
          await getSyncIntegration(projectId, provider, tx),
          c.req.valid("json").rules,
          tx,
        );
      }),
      200,
    );
  })
  .openapi(saveRoute, async (c) => {
    const { projectId, provider } = c.req.valid("param");
    const { rules, previewToken } = c.req.valid("json");
    return c.json(
      await saveSyncRules(
        projectId,
        provider,
        rules,
        previewToken,
        c.get("workspaceId"),
      ),
      200,
    );
  })
  .openapi(reviewRoute, async (c) => {
    const { projectId, provider, linkId } = c.req.valid("param");
    const review = await reviewSyncResume(
      projectId,
      provider,
      linkId,
      c.get("workspaceId"),
    );
    return c.json(
      {
        task: {
          id: review.task.id,
          number: review.task.number,
          title: review.task.title,
        },
        local: review.local,
        remote: review.remote,
        token: review.token,
      },
      200,
    );
  })
  .openapi(resumeRoute, async (c) => {
    const { projectId, provider, linkId } = c.req.valid("param");
    const { source, token } = c.req.valid("json");
    return c.json(
      await resumeSync(
        projectId,
        provider,
        linkId,
        token,
        source,
        c.get("workspaceId"),
      ),
      200,
    );
  });

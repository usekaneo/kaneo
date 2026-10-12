import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import {
  workspaceAccess,
  workspaceAccessMiddleware,
} from "../utils/workspace-access-middleware";
import deleteWorkflowRule from "./controllers/delete-workflow-rule";
import getWorkflowRules from "./controllers/get-workflow-rules";
import upsertWorkflowRule from "./controllers/upsert-workflow-rule";
import { workflowRuleListSchema, workflowRuleRowSchema } from "./response";
import {
  projectIdParam,
  upsertWorkflowRuleBody,
  workflowRuleParam,
} from "./schema";

const getWorkflowRulesRoute = createRoute({
  method: "get",
  operationId: "getWorkflowRules",
  path: "/{projectId}",
  tags: ["Workflow Rules"],
  summary: "Get workflow rules",
  description:
    "Get every workflow rule for a project. A rule moves a task to a column when an integration event fires. Rules with a null integrationId are type-wide; rules with an integrationId are scoped to that repository binding (RFC 0001).",
  middleware: [workspaceAccess.fromProject("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("List of workflow rules", workflowRuleListSchema),
    403: errorResponse("No access to the project"),
    404: errorResponse("Project not found"),
  },
});

const upsertWorkflowRuleRoute = createRoute({
  method: "put",
  operationId: "upsertWorkflowRule",
  path: "/{projectId}",
  tags: ["Workflow Rules"],
  summary: "Upsert workflow rule",
  description:
    "Create a workflow rule, or update the target column of the existing rule for the same integration and event. Provide an optional integrationId to scope the rule to a single repository binding; omit it for a type-wide rule (RFC 0001).",
  middleware: [
    // RFC 0001 WP6: authorize the project, and the integration too when the
    // rule targets one. The integration source is only consulted when the
    // body carries an integrationId, so type-wide requests keep working; the
    // controller additionally rejects an integration from a foreign project
    // or of a mismatched type.
    workspaceAccessMiddleware({
      sources: [
        { type: "lookup", resource: "project", idKey: "projectId" },
        { type: "lookup", resource: "integration", idKey: "integrationId" },
      ],
    }),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: upsertWorkflowRuleBody } },
    },
  },
  responses: {
    200: jsonResponse("The created or updated rule", workflowRuleRowSchema),
    400: errorResponse("Invalid body"),
    403: errorResponse(
      "No access to the project, or missing project:update permission",
    ),
    404: errorResponse("Project not found"),
  },
});

const deleteWorkflowRuleRoute = createRoute({
  method: "delete",
  operationId: "deleteWorkflowRule",
  path: "/{id}",
  tags: ["Workflow Rules"],
  summary: "Delete workflow rule",
  description: "Delete a workflow rule. Returns the rule that was removed.",
  middleware: [
    workspaceAccess.fromWorkflowRule("id"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: workflowRuleParam },
  responses: {
    200: jsonResponse("The deleted rule", workflowRuleRowSchema),
    403: errorResponse(
      "No access to the project, or missing project:update permission",
    ),
    404: errorResponse("Workflow rule not found"),
  },
});

const workflowRule = apiRouter()
  .openapi(getWorkflowRulesRoute, async (c) =>
    c.json(await getWorkflowRules(c.req.valid("param").projectId), 200),
  )
  .openapi(upsertWorkflowRuleRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const { integrationType, eventType, columnId, integrationId } =
      c.req.valid("json");
    return c.json(
      await upsertWorkflowRule({
        projectId,
        integrationType,
        eventType,
        columnId,
        integrationId: integrationId ?? null,
      }),
      200,
    );
  })
  .openapi(deleteWorkflowRuleRoute, async (c) =>
    c.json(await deleteWorkflowRule(c.req.valid("param").id), 200),
  );

export default workflowRule;

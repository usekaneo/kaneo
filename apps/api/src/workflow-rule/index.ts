import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
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
    "Get every workflow rule for a project. A rule moves a task to a column when an integration event fires.",
  middleware: [workspaceAccess.fromProject("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse("List of workflow rules", workflowRuleListSchema),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const upsertWorkflowRuleRoute = createRoute({
  method: "put",
  operationId: "upsertWorkflowRule",
  path: "/{projectId}",
  tags: ["Workflow Rules"],
  summary: "Upsert workflow rule",
  description:
    "Create a workflow rule, or update the target column of the existing rule for the same integration and event.",
  middleware: [
    workspaceAccess.fromProject("projectId"),
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
    400: errorResponse("Invalid body, or unknown project"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
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
    400: errorResponse(
      "Unknown rule, or its workspace could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const workflowRule = apiRouter()
  .openapi(getWorkflowRulesRoute, async (c) =>
    c.json(await getWorkflowRules(c.req.valid("param").projectId), 200),
  )
  .openapi(upsertWorkflowRuleRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const { integrationType, eventType, columnId } = c.req.valid("json");
    return c.json(
      await upsertWorkflowRule({
        projectId,
        integrationType,
        eventType,
        columnId,
      }),
      200,
    );
  })
  .openapi(deleteWorkflowRuleRoute, async (c) =>
    c.json(await deleteWorkflowRule(c.req.valid("param").id), 200),
  );

export default workflowRule;

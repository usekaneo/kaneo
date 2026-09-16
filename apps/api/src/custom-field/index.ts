import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createCustomField from "./controllers/create-custom-field";
import deleteCustomField from "./controllers/delete-custom-field";
import getCustomFieldFilterValues from "./controllers/get-custom-field-filter-values";
import getCustomFieldValuesByProject from "./controllers/get-custom-field-values-by-project";
import getCustomFieldValuesByTask from "./controllers/get-custom-field-values-by-task";
import getCustomFieldsByProject from "./controllers/get-custom-fields-by-project";
import reorderCustomFields from "./controllers/reorder-custom-field";
import setCustomFieldValue from "./controllers/set-custom-field-value";
import {
  customFieldDefinitionListSchema,
  customFieldDefinitionSchema,
  customFieldFilterValuesListSchema,
  customFieldValueListSchema,
  reorderCustomFieldsResponseSchema,
  setCustomFieldValueResponseSchema,
} from "./response";
import {
  createCustomFieldBody,
  customFieldIdParam,
  projectIdParam,
  reorderCustomFieldsBody,
  setCustomFieldValueBody,
  taskIdParam,
} from "./schema";

const getCustomFieldsRoute = createRoute({
  method: "get",
  operationId: "getCustomFieldsByProject",
  path: "/project/{projectId}",
  tags: ["Custom Fields"],
  summary: "Get custom fields",
  description: "Get all custom field definitions for a project.",
  middleware: [workspaceAccess.fromProject("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse(
      "List of custom field definitions",
      customFieldDefinitionListSchema,
    ),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const getCustomFieldValuesByProjectRoute = createRoute({
  method: "get",
  operationId: "getCustomFieldValuesByProject",
  path: "/project/{projectId}/values",
  tags: ["Custom Fields"],
  summary: "Get project custom field values",
  description: "Get all custom field values for every task in a project.",
  middleware: [workspaceAccess.fromProject("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse(
      "List of custom field values for the project",
      customFieldValueListSchema,
    ),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const getCustomFieldValuesByTaskRoute = createRoute({
  method: "get",
  operationId: "getCustomFieldValuesByTask",
  path: "/task/{taskId}",
  tags: ["Custom Fields"],
  summary: "Get task custom field values",
  description: "Get all custom field values for a task with their definitions.",
  middleware: [workspaceAccess.fromTaskId("taskId")] as const,
  request: { params: taskIdParam },
  responses: {
    200: jsonResponse(
      "List of custom field values for the task",
      customFieldValueListSchema,
    ),
    400: errorResponse(
      "Unknown task, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the task's workspace"),
  },
});

const getCustomFieldFilterValuesRoute = createRoute({
  method: "get",
  operationId: "getCustomFieldFilterValues",
  path: "/project/{projectId}/filter-values",
  tags: ["Custom Fields"],
  summary: "Get custom field filter values",
  description:
    "Get distinct values used by tasks for each custom field of a project.",
  middleware: [workspaceAccess.fromProject("projectId")] as const,
  request: { params: projectIdParam },
  responses: {
    200: jsonResponse(
      "Distinct values used for each custom field",
      customFieldFilterValuesListSchema,
    ),
    400: errorResponse(
      "Unknown project, or its workspace could not be determined",
    ),
    403: errorResponse("No access to the project's workspace"),
  },
});

const createCustomFieldRoute = createRoute({
  method: "post",
  operationId: "createCustomField",
  path: "/",
  tags: ["Custom Fields"],
  summary: "Create custom field",
  description: "Create a custom field definition for a project.",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: createCustomFieldBody } },
    },
  },
  responses: {
    200: jsonResponse("The created custom field", customFieldDefinitionSchema),
    400: errorResponse("Invalid body, or unknown project"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const reorderCustomFieldsRoute = createRoute({
  method: "put",
  operationId: "reorderCustomFields",
  path: "/reorder/{projectId}",
  tags: ["Custom Fields"],
  summary: "Reorder custom fields",
  description: "Set new positions for a project's custom fields.",
  middleware: [
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: {
    params: projectIdParam,
    body: {
      required: true,
      content: { "application/json": { schema: reorderCustomFieldsBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "The reordered custom fields",
      reorderCustomFieldsResponseSchema,
    ),
    400: errorResponse("A custom field does not belong to this project"),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const setCustomFieldValueRoute = createRoute({
  method: "put",
  operationId: "setCustomFieldValue",
  path: "/value",
  tags: ["Custom Fields"],
  summary: "Set custom field value",
  description: "Create or update a custom field value for a task.",
  middleware: [
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["update"] }),
  ] as const,
  request: {
    body: {
      required: true,
      content: { "application/json": { schema: setCustomFieldValueBody } },
    },
  },
  responses: {
    200: jsonResponse(
      "The saved custom field value",
      setCustomFieldValueResponseSchema,
    ),
    400: errorResponse("Invalid body, unknown task, or unknown custom field"),
    403: errorResponse(
      "No workspace access, or missing task:update permission",
    ),
  },
});

const deleteCustomFieldRoute = createRoute({
  method: "delete",
  operationId: "deleteCustomField",
  path: "/{id}",
  tags: ["Custom Fields"],
  summary: "Delete custom field",
  description: "Delete a custom field definition by ID.",
  middleware: [
    workspaceAccess.fromCustomField("id"),
    requireWorkspacePermission({ project: ["update"] }),
  ] as const,
  request: { params: customFieldIdParam },
  responses: {
    200: jsonResponse("The deleted custom field", customFieldDefinitionSchema),
    400: errorResponse(
      "Unknown custom field, or its workspace could not be determined",
    ),
    403: errorResponse(
      "No workspace access, or missing project:update permission",
    ),
  },
});

const customField = apiRouter()
  .openapi(getCustomFieldsRoute, async (c) =>
    c.json(await getCustomFieldsByProject(c.req.valid("param").projectId), 200),
  )
  .openapi(getCustomFieldValuesByProjectRoute, async (c) =>
    c.json(
      await getCustomFieldValuesByProject(c.req.valid("param").projectId),
      200,
    ),
  )
  .openapi(getCustomFieldValuesByTaskRoute, async (c) =>
    c.json(await getCustomFieldValuesByTask(c.req.valid("param").taskId), 200),
  )
  .openapi(getCustomFieldFilterValuesRoute, async (c) =>
    c.json(
      await getCustomFieldFilterValues(c.req.valid("param").projectId),
      200,
    ),
  )
  .openapi(createCustomFieldRoute, async (c) => {
    const { projectId, name, type, required, defaultValue, options } =
      c.req.valid("json");

    return c.json(
      await createCustomField(
        projectId,
        name,
        type,
        required,
        defaultValue,
        options,
      ),
      200,
    );
  })
  .openapi(reorderCustomFieldsRoute, async (c) => {
    const { projectId } = c.req.valid("param");
    const { fields } = c.req.valid("json");

    return c.json(await reorderCustomFields(projectId, fields), 200);
  })
  .openapi(setCustomFieldValueRoute, async (c) => {
    const { taskId, fieldId, value } = c.req.valid("json");

    return c.json(await setCustomFieldValue(taskId, fieldId, value), 200);
  })
  .openapi(deleteCustomFieldRoute, async (c) =>
    c.json(await deleteCustomField(c.req.valid("param").id), 200),
  );

export default customField;

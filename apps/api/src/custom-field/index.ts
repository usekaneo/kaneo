import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import db from "../database";
import { customFieldDefinitionTable, projectTable } from "../database/schema";
import { requireWorkspacePermission } from "../utils/require-workspace-permission";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import createCustomField from "./controllers/create-custom-field";
import deleteCustomField from "./controllers/delete-custom-field";
import getCustomFieldFilterValues from "./controllers/get-custom-field-filter-values";
import getCustomFieldValuesByTask from "./controllers/get-custom-field-values-by-task";
import getCustomFieldsByProject from "./controllers/get-custom-fields-by-project";
import setCustomFieldValue from "./controllers/set-custom-field-value";

const customFieldDefinitionSchema = v.object({
  id: v.string(),
  projectId: v.string(),
  name: v.string(),
  type: v.string(),
  required: v.boolean(),
  defaultValue: v.nullable(v.string()),
  options: v.nullable(v.any()),
  position: v.number(),
  createdAt: v.date(),
  updatedAt: v.date(),
});

const customFieldValueSchema = v.object({
  id: v.string(),
  taskId: v.string(),
  fieldId: v.string(),
  value: v.nullable(v.string()),
  fieldName: v.string(),
  fieldType: v.string(),
  fieldOptions: v.nullable(v.any()),
});

const customField = new Hono<{
  Variables: {
    userId: string;
    workspaceId: string;
  };
}>()
  .get(
    "/project/:projectId",
    describeRoute({
      operationId: "getCustomFieldsByProject",
      tags: ["Custom Fields"],
      description: "Get all custom field definitions for a project",
      responses: {
        200: {
          description: "List of custom field definitions",
          content: {
            "application/json": {
              schema: resolver(v.array(customFieldDefinitionSchema)),
            },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const fields = await getCustomFieldsByProject(projectId);
      return c.json(fields);
    },
  )
  .get(
    "/task/:taskId",
    describeRoute({
      operationId: "getCustomFieldValuesByTask",
      tags: ["Custom Fields"],
      description: "Get all custom field values for a task",
      responses: {
        200: {
          description: "List of custom field values with their definitions",
          content: {
            "application/json": {
              schema: resolver(v.array(customFieldValueSchema)),
            },
          },
        },
      },
    }),
    validator("param", v.object({ taskId: v.string() })),
    workspaceAccess.fromTaskId("taskId"),
    async (c) => {
      const { taskId } = c.req.valid("param");
      const values = await getCustomFieldValuesByTask(taskId);
      return c.json(values);
    },
  )
  .get(
    "/project/:projectId/filter-values",
    describeRoute({
      operationId: "getCustomFieldFilterValues",
      tags: ["Custom Fields"],
      description:
        "Get distinct values actually used by tasks for each custom field of a project (for filters)",
      responses: {
        200: {
          description: "List of custom fields with their distinct used values",
          content: {
            "application/json": {
              schema: resolver(
                v.array(
                  v.object({
                    fieldId: v.string(),
                    fieldName: v.string(),
                    fieldType: v.string(),
                    values: v.array(v.string()),
                  }),
                ),
              ),
            },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const filterValues = await getCustomFieldFilterValues(projectId);
      return c.json(filterValues);
    },
  )
  .post(
    "/",
    describeRoute({
      operationId: "createCustomField",
      tags: ["Custom Fields"],
      description: "Create a new custom field definition for a project",
      responses: {
        200: {
          description: "Custom field created successfully",
          content: {
            "application/json": {
              schema: resolver(customFieldDefinitionSchema),
            },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        projectId: v.string(),
        name: v.string(),
        type: v.picklist(["text", "number", "date", "dropdown", "boolean"]),
        required: v.optional(v.boolean(), false),
        defaultValue: v.optional(v.string()),
        options: v.optional(v.array(v.string())),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    requireWorkspacePermission({ task: ["update"] }),
    async (c) => {
      const { projectId, name, type, required, defaultValue, options } =
        c.req.valid("json");

      const workspaceId = c.get("workspaceId");

      const field = await createCustomField(
        projectId,
        workspaceId,
        name,
        type,
        required,
        defaultValue,
        options,
      );
      return c.json(field);
    },
  )
  .put(
    "/value",
    describeRoute({
      operationId: "setCustomFieldValue",
      tags: ["Custom Fields"],
      description: "Set (create or update) a custom field value for a task",
      responses: {
        200: {
          description: "Custom field value set successfully",
          content: {
            "application/json": {
              schema: resolver(
                v.object({
                  id: v.string(),
                  taskId: v.string(),
                  fieldId: v.string(),
                  value: v.nullable(v.string()),
                }),
              ),
            },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        taskId: v.string(),
        fieldId: v.string(),
        value: v.string(),
      }),
    ),
    workspaceAccess.fromTaskId("taskId"),
    requireWorkspacePermission({ task: ["update"] }),
    async (c) => {
      const { taskId, fieldId, value } = c.req.valid("json");

      const [field] = await db
        .select()
        .from(customFieldDefinitionTable)
        .where(eq(customFieldDefinitionTable.id, fieldId))
        .limit(1);

      if (!field) {
        throw new HTTPException(404, {
          message: "Custom field not found",
        });
      }

      const normalizedValue = value.trim();

      if (field.required && normalizedValue.length === 0) {
        throw new HTTPException(400, {
          message: "This custom field is required",
        });
      }

      if (
        field.type === "dropdown" &&
        normalizedValue.length > 0 &&
        Array.isArray(field.options) &&
        !field.options.includes(normalizedValue)
      ) {
        throw new HTTPException(400, {
          message: "Invalid option for this custom field",
        });
      }

      if (
        field.type === "number" &&
        normalizedValue.length > 0 &&
        Number.isNaN(Number(normalizedValue))
      ) {
        throw new HTTPException(400, {
          message: "Value must be a valid number",
        });
      }

      if (
        field.type === "boolean" &&
        normalizedValue.length > 0 &&
        normalizedValue !== "true" &&
        normalizedValue !== "false"
      ) {
        throw new HTTPException(400, {
          message: "Value must be true or false",
        });
      }

      const result = await setCustomFieldValue(
        taskId,
        fieldId,
        normalizedValue,
      );
      return c.json(result);
    },
  )
  .delete(
    "/:id",
    describeRoute({
      operationId: "deleteCustomField",
      tags: ["Custom Fields"],
      description: "Delete a custom field definition by ID",
      responses: {
        200: {
          description: "Custom field deleted successfully",
          content: {
            "application/json": {
              schema: resolver(customFieldDefinitionSchema),
            },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    async (c, next) => {
      const { id } = c.req.valid("param");

      const [field] = await db
        .select({ projectId: customFieldDefinitionTable.projectId })
        .from(customFieldDefinitionTable)
        .where(eq(customFieldDefinitionTable.id, id))
        .limit(1);

      if (!field) {
        throw new HTTPException(404, { message: "Custom field not found" });
      }

      const [project] = await db
        .select({ workspaceId: projectTable.workspaceId })
        .from(projectTable)
        .where(eq(projectTable.id, field.projectId))
        .limit(1);

      if (!project) {
        throw new HTTPException(404, { message: "Project not found" });
      }

      c.set("workspaceId", project.workspaceId);
      await next();
    },
    requireWorkspacePermission({ task: ["update"] }),
    async (c) => {
      const { id } = c.req.valid("param");
      const field = await deleteCustomField(id);
      return c.json(field);
    },
  );

export default customField;

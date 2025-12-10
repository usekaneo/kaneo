import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import createLabel from "./controllers/create-label";
import deleteLabel from "./controllers/delete-label";
import getLabel from "./controllers/get-label";
import getLabelsByTaskId from "./controllers/get-labels-by-task-id";
import getLabelsByWorkspaceId from "./controllers/get-labels-by-workspace-id";
import updateLabel from "./controllers/update-label";

const label = new Hono()
  .get(
    "/task/:taskId",
    describeRoute({
      operationId: "getTaskLabels",
      tags: ["Labels"],
      description: "Get all labels assigned to a specific task",
      responses: {
        200: {
          description: "List of labels for the task",
          content: {
            "application/json": { schema: resolver(v.array(v.any())) },
          },
        },
      },
    }),
    validator("param", v.object({ taskId: v.string() })),
    async (c) => {
      const { taskId } = c.req.valid("param");
      const labels = await getLabelsByTaskId(taskId);
      return c.json(labels);
    },
  )
  .get(
    "/workspace/:workspaceId",
    describeRoute({
      operationId: "getWorkspaceLabels",
      tags: ["Labels"],
      description: "Get all labels for a specific workspace",
      responses: {
        200: {
          description: "List of labels in the workspace",
          content: {
            "application/json": { schema: resolver(v.array(v.any())) },
          },
        },
      },
    }),
    validator("param", v.object({ workspaceId: v.string() })),
    async (c) => {
      const { workspaceId } = c.req.valid("param");
      const labels = await getLabelsByWorkspaceId(workspaceId);
      return c.json(labels);
    },
  )
  .post(
    "/",
    describeRoute({
      operationId: "createLabel",
      tags: ["Labels"],
      description: "Create a new label in a workspace",
      responses: {
        200: {
          description: "Label created successfully",
          content: {
            "application/json": { schema: resolver(v.any()) },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        name: v.string(),
        color: v.string(),
        workspaceId: v.string(),
        description: v.optional(v.string()),
      }),
    ),
    async (c) => {
      const { name, color, workspaceId, description } = c.req.valid("json");
      const label = await createLabel(
        name,
        color,
        workspaceId,
        description ?? "",
      );
      return c.json(label);
    },
  )
  .get(
    "/:id",
    describeRoute({
      operationId: "getLabel",
      tags: ["Labels"],
      description: "Get a specific label by ID",
      responses: {
        200: {
          description: "Label details",
          content: {
            "application/json": { schema: resolver(v.any()) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    async (c) => {
      const { id } = c.req.valid("param");
      const label = await getLabel(id);
      return c.json(label);
    },
  )
  .put(
    "/:id",
    describeRoute({
      operationId: "updateLabel",
      tags: ["Labels"],
      description: "Update an existing label",
      responses: {
        200: {
          description: "Label updated successfully",
          content: {
            "application/json": { schema: resolver(v.any()) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({
        name: v.string(),
        color: v.string(),
        description: v.optional(v.string()),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid("param");
      const { name, color } = c.req.valid("json");
      const label = await updateLabel(id, name, color);
      return c.json(label);
    },
  )
  .delete(
    "/:id",
    describeRoute({
      operationId: "deleteLabel",
      tags: ["Labels"],
      description: "Delete a label by ID",
      responses: {
        200: {
          description: "Label deleted successfully",
          content: {
            "application/json": { schema: resolver(v.any()) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    async (c) => {
      const { id } = c.req.valid("param");
      const label = await deleteLabel(id);
      return c.json(label);
    },
  );

export default label;

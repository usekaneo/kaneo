import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import db from "../database";
import {
  assetTable,
  projectTable,
  taskTable,
  workspaceTable,
} from "../database/schema";
import { taskSchema } from "../schemas";
import {
  assertTaskImageKeyMatchesContext,
  createTaskImageUploadUrl,
  isImageContentType,
  validateTaskAssetUploadInput,
} from "../storage/s3";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import bulkUpdateTasks from "./controllers/bulk-update-tasks";
import createTask from "./controllers/create-task";
import deleteTask from "./controllers/delete-task";
import exportTasks from "./controllers/export-tasks";
import getTask from "./controllers/get-task";
import getTasks from "./controllers/get-tasks";
import importTasks from "./controllers/import-tasks";
import moveTask from "./controllers/move-task";
import updateTask from "./controllers/update-task";
import updateTaskAssignee from "./controllers/update-task-assignee";
import updateTaskDescription from "./controllers/update-task-description";
import updateTaskDueDate from "./controllers/update-task-due-date";
import updateTaskPriority from "./controllers/update-task-priority";
import updateTaskStatus from "./controllers/update-task-status";
import updateTaskTitle from "./controllers/update-task-title";
import { VALID_PRIORITIES } from "./validate-task-fields";

const task = new Hono<{
  Variables: {
    userId: string;
  };
}>()
  .get(
    "/tasks/:projectId",
    describeRoute({
      operationId: "listTasks",
      tags: ["Tasks"],
      description: "Get all tasks for a specific project",
      responses: {
        200: {
          description: "Project with tasks organized by columns",
          content: {
            "application/json": { schema: resolver(v.any()) },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    validator(
      "query",
      v.optional(
        v.object({
          status: v.optional(v.string()),
          priority: v.optional(v.string()),
          assigneeId: v.optional(v.string()),
          page: v.optional(v.pipe(v.string(), v.transform(Number))),
          limit: v.optional(v.pipe(v.string(), v.transform(Number))),
          sortBy: v.optional(
            v.picklist([
              "createdAt",
              "priority",
              "dueDate",
              "position",
              "title",
              "number",
            ]),
          ),
          sortOrder: v.optional(v.picklist(["asc", "desc"])),
          dueBefore: v.optional(v.string()),
          dueAfter: v.optional(v.string()),
        }),
      ),
    ),
    workspaceAccess.fromProject("projectId"),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const filters = c.req.valid("query") || {};

      const tasks = await getTasks(projectId, filters);

      return c.json(tasks);
    },
  )
  .patch(
    "/bulk",
    describeRoute({
      operationId: "bulkUpdateTasks",
      tags: ["Tasks"],
      description: "Perform bulk operations on multiple tasks",
      responses: {
        200: {
          description: "Bulk operation completed successfully",
          content: {
            "application/json": {
              schema: resolver(
                v.object({
                  success: v.boolean(),
                  updatedCount: v.number(),
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
        taskIds: v.pipe(v.array(v.string()), v.minLength(1)),
        operation: v.picklist([
          "updateStatus",
          "updatePriority",
          "updateAssignee",
          "delete",
          "addLabel",
          "removeLabel",
          "updateDueDate",
        ] as const),
        value: v.optional(v.nullable(v.string())),
      }),
    ),
    async (c) => {
      const { taskIds, operation, value } = c.req.valid("json");
      const userId = c.get("userId");

      if (!userId) {
        throw new HTTPException(401, { message: "Unauthorized" });
      }

      if (
        operation !== "delete" &&
        operation !== "updateDueDate" &&
        value === undefined
      ) {
        throw new HTTPException(400, {
          message: "Value is required for this operation",
        });
      }

      const result = await bulkUpdateTasks({
        taskIds,
        operation,
        value,
        userId,
      });

      return c.json(result);
    },
  )
  .post(
    "/:projectId",
    describeRoute({
      operationId: "createTask",
      tags: ["Tasks"],
      description: "Create a new task in a project",
      responses: {
        200: {
          description: "Task created successfully",
          content: {
            "application/json": { schema: resolver(taskSchema) },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        title: v.string(),
        description: v.string(),
        startDate: v.optional(v.string()),
        dueDate: v.optional(v.string()),
        priority: v.picklist(VALID_PRIORITIES),
        status: v.string(),
        userId: v.optional(v.string()),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    async (c) => {
      const { projectId } = c.req.param();
      const {
        title,
        description,
        startDate,
        dueDate,
        priority,
        status,
        userId,
      } = c.req.valid("json");

      const task = await createTask({
        projectId,
        currentUserId: c.get("userId"),
        userId: userId,
        title,
        description,
        startDate: startDate ? new Date(startDate) : undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        priority,
        status,
      });

      return c.json(task);
    },
  )
  .get(
    "/:id",
    describeRoute({
      operationId: "getTask",
      tags: ["Tasks"],
      description: "Get a specific task by ID",
      responses: {
        200: {
          description: "Task details",
          content: {
            "application/json": { schema: resolver(taskSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromTask(),
    async (c) => {
      const { id } = c.req.valid("param");

      const task = await getTask(id);

      return c.json(task);
    },
  )
  .put(
    "/move/:id",
    describeRoute({
      operationId: "moveTask",
      tags: ["Tasks"],
      description: "Move a task to another project",
      responses: {
        200: {
          description: "Task moved successfully",
          content: {
            "application/json": {
              schema: resolver(
                v.object({
                  task: taskSchema,
                  sourceProjectId: v.string(),
                  destinationProjectId: v.string(),
                }),
              ),
            },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({
        destinationProjectId: v.string(),
        destinationStatus: v.optional(v.string()),
      }),
    ),
    workspaceAccess.fromTask(),
    async (c) => {
      const { id } = c.req.valid("param");
      const { destinationProjectId, destinationStatus } = c.req.valid("json");
      const currentUserId = c.get("userId");

      const result = await moveTask({
        taskId: id,
        destinationProjectId,
        destinationStatus,
        currentUserId,
      });

      return c.json(result);
    },
  )
  .put(
    "/:id",
    describeRoute({
      operationId: "updateTask",
      tags: ["Tasks"],
      description: "Update all fields of a task",
      responses: {
        200: {
          description: "Task updated successfully",
          content: {
            "application/json": { schema: resolver(taskSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({
        title: v.string(),
        description: v.string(),
        startDate: v.optional(v.string()),
        dueDate: v.optional(v.string()),
        priority: v.picklist(VALID_PRIORITIES),
        status: v.string(),
        projectId: v.string(),
        position: v.number(),
        userId: v.optional(v.string()),
      }),
    ),
    workspaceAccess.fromTask(),
    async (c) => {
      const { id } = c.req.valid("param");
      const {
        title,
        description,
        startDate,
        dueDate,
        priority,
        status,
        projectId,
        position,
        userId,
      } = c.req.valid("json");

      const currentUserId = c.get("userId");

      const task = await updateTask(
        id,
        title,
        status,
        startDate ? new Date(startDate) : undefined,
        dueDate ? new Date(dueDate) : undefined,
        projectId,
        description,
        priority,
        position,
        userId,
        currentUserId,
      );

      return c.json(task);
    },
  )
  .get(
    "/export/:projectId",
    describeRoute({
      operationId: "exportTasks",
      tags: ["Tasks"],
      description: "Export all tasks from a project",
      responses: {
        200: {
          description: "Exported tasks data",
          content: {
            "application/json": { schema: resolver(v.any()) },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    workspaceAccess.fromProject("projectId"),
    async (c) => {
      const { projectId } = c.req.valid("param");

      const exportData = await exportTasks(projectId);

      return c.json(exportData);
    },
  )
  .post(
    "/import/:projectId",
    describeRoute({
      operationId: "importTasks",
      tags: ["Tasks"],
      description: "Import multiple tasks into a project",
      responses: {
        200: {
          description: "Tasks imported successfully",
          content: {
            "application/json": { schema: resolver(v.any()) },
          },
        },
      },
    }),
    validator("param", v.object({ projectId: v.string() })),
    validator(
      "json",
      v.object({
        tasks: v.array(
          v.object({
            title: v.string(),
            description: v.optional(v.string()),
            status: v.string(),
            priority: v.optional(v.string()),
            startDate: v.optional(v.nullable(v.string())),
            dueDate: v.optional(v.nullable(v.string())),
            userId: v.optional(v.nullable(v.string())),
          }),
        ),
      }),
    ),
    workspaceAccess.fromProject("projectId"),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const { tasks } = c.req.valid("json");
      const currentUserId = c.get("userId");

      const result = await importTasks(projectId, tasks, currentUserId);

      return c.json(result);
    },
  )
  .delete(
    "/:id",
    describeRoute({
      operationId: "deleteTask",
      tags: ["Tasks"],
      description: "Delete a task by ID",
      responses: {
        200: {
          description: "Task deleted successfully",
          content: {
            "application/json": { schema: resolver(taskSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    workspaceAccess.fromTask(),
    async (c) => {
      const { id } = c.req.valid("param");

      const currentUserId = c.get("userId");
      const task = await deleteTask(id, currentUserId);

      return c.json(task);
    },
  )
  .put(
    "/status/:id",
    describeRoute({
      operationId: "updateTaskStatus",
      tags: ["Tasks"],
      description: "Update only the status of a task",
      responses: {
        200: {
          description: "Task status updated successfully",
          content: {
            "application/json": { schema: resolver(taskSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator("json", v.object({ status: v.string() })),
    workspaceAccess.fromTask(),
    async (c) => {
      const { id } = c.req.valid("param");
      const { status } = c.req.valid("json");
      const currentUserId = c.get("userId");

      const task = await updateTaskStatus({ id, status, currentUserId });

      return c.json(task);
    },
  )
  .put(
    "/priority/:id",
    describeRoute({
      operationId: "updateTaskPriority",
      tags: ["Tasks"],
      description: "Update only the priority of a task",
      responses: {
        200: {
          description: "Task priority updated successfully",
          content: {
            "application/json": { schema: resolver(taskSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator("json", v.object({ priority: v.picklist(VALID_PRIORITIES) })),
    workspaceAccess.fromTask(),
    async (c) => {
      const { id } = c.req.valid("param");
      const { priority } = c.req.valid("json");
      const currentUserId = c.get("userId");

      const task = await updateTaskPriority({ id, priority, currentUserId });

      return c.json(task);
    },
  )
  .put(
    "/assignee/:id",
    describeRoute({
      operationId: "updateTaskAssignee",
      tags: ["Tasks"],
      description: "Assign or unassign a task to a user",
      responses: {
        200: {
          description: "Task assignee updated successfully",
          content: {
            "application/json": { schema: resolver(taskSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator("json", v.object({ userId: v.string() })),
    workspaceAccess.fromTask(),
    async (c) => {
      const { id } = c.req.valid("param");
      const { userId } = c.req.valid("json");
      const currentUserId = c.get("userId");

      const task = await updateTaskAssignee({ id, userId, currentUserId });

      return c.json(task);
    },
  )
  .put(
    "/due-date/:id",
    describeRoute({
      operationId: "updateTaskDueDate",
      tags: ["Tasks"],
      description: "Update only the due date of a task",
      responses: {
        200: {
          description: "Task due date updated successfully",
          content: {
            "application/json": { schema: resolver(taskSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator("json", v.object({ dueDate: v.optional(v.string()) })),
    workspaceAccess.fromTask(),
    async (c) => {
      const { id } = c.req.valid("param");
      const { dueDate = null } = c.req.valid("json");
      const currentUserId = c.get("userId");

      const task = await updateTaskDueDate({
        id,
        dueDate: dueDate ? new Date(dueDate) : null,
        currentUserId,
      });

      return c.json(task);
    },
  )

  .put(
    "/title/:id",
    describeRoute({
      operationId: "updateTaskTitle",
      tags: ["Tasks"],
      description: "Update only the title of a task",
      responses: {
        200: {
          description: "Task title updated successfully",
          content: {
            "application/json": { schema: resolver(taskSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator("json", v.object({ title: v.string() })),
    workspaceAccess.fromTask(),
    async (c) => {
      const { id } = c.req.valid("param");
      const { title } = c.req.valid("json");
      const currentUserId = c.get("userId");

      const task = await updateTaskTitle({ id, title, currentUserId });

      return c.json(task);
    },
  )

  .put(
    "/image-upload/:id",
    describeRoute({
      operationId: "createTaskImageUpload",
      tags: ["Tasks"],
      description:
        "Create a presigned image upload URL for a task description or comment",
      responses: {
        200: {
          description: "Image upload URL created successfully",
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
        filename: v.string(),
        contentType: v.string(),
        size: v.number(),
        surface: v.picklist(["description", "comment"] as const),
      }),
    ),
    workspaceAccess.fromTask(),
    async (c) => {
      const { id } = c.req.valid("param");
      const { filename, contentType, size, surface } = c.req.valid("json");

      try {
        validateTaskAssetUploadInput(contentType, size);
      } catch (error) {
        throw new HTTPException(400, {
          message:
            error instanceof Error
              ? error.message
              : "Invalid image upload request",
        });
      }

      const [taskContext] = await db
        .select({
          taskId: taskTable.id,
          projectId: taskTable.projectId,
          workspaceId: workspaceTable.id,
        })
        .from(taskTable)
        .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
        .innerJoin(
          workspaceTable,
          eq(projectTable.workspaceId, workspaceTable.id),
        )
        .where(eq(taskTable.id, id))
        .limit(1);

      if (!taskContext) {
        throw new HTTPException(404, { message: "Task not found" });
      }

      try {
        const upload = await createTaskImageUploadUrl({
          workspaceId: taskContext.workspaceId,
          projectId: taskContext.projectId,
          taskId: taskContext.taskId,
          surface,
          filename,
          contentType,
        });

        return c.json(upload);
      } catch (error) {
        throw new HTTPException(503, {
          message:
            error instanceof Error
              ? error.message
              : "Image uploads are not configured",
        });
      }
    },
  )
  .post(
    "/image-upload/:id/finalize",
    describeRoute({
      operationId: "finalizeTaskImageUpload",
      tags: ["Tasks"],
      description:
        "Finalize an uploaded task image and create a private asset record",
      responses: {
        200: {
          description: "Image upload finalized successfully",
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
        key: v.string(),
        filename: v.string(),
        contentType: v.string(),
        size: v.number(),
        surface: v.picklist(["description", "comment"] as const),
      }),
    ),
    workspaceAccess.fromTask(),
    async (c) => {
      const { id } = c.req.valid("param");
      const { key, filename, contentType, size, surface } = c.req.valid("json");
      const userId = c.get("userId");

      try {
        validateTaskAssetUploadInput(contentType, size);
      } catch (error) {
        throw new HTTPException(400, {
          message:
            error instanceof Error
              ? error.message
              : "Invalid image upload request",
        });
      }

      const [taskContext] = await db
        .select({
          taskId: taskTable.id,
          projectId: taskTable.projectId,
          workspaceId: workspaceTable.id,
        })
        .from(taskTable)
        .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
        .innerJoin(
          workspaceTable,
          eq(projectTable.workspaceId, workspaceTable.id),
        )
        .where(eq(taskTable.id, id))
        .limit(1);

      if (!taskContext) {
        throw new HTTPException(404, { message: "Task not found" });
      }

      const normalizedKey = key.trim();
      if (
        !assertTaskImageKeyMatchesContext(normalizedKey, {
          workspaceId: taskContext.workspaceId,
          projectId: taskContext.projectId,
          taskId: taskContext.taskId,
          surface,
        })
      ) {
        throw new HTTPException(400, {
          message: "Image upload key does not match the task context.",
        });
      }

      const [existingAsset] = await db
        .select({ id: assetTable.id })
        .from(assetTable)
        .where(eq(assetTable.objectKey, normalizedKey))
        .limit(1);

      const [asset] = existingAsset
        ? await db
            .update(assetTable)
            .set({
              workspaceId: taskContext.workspaceId,
              projectId: taskContext.projectId,
              taskId: taskContext.taskId,
              filename,
              mimeType: contentType,
              size,
              kind: isImageContentType(contentType) ? "image" : "attachment",
              surface,
              createdBy: userId || null,
            })
            .where(eq(assetTable.id, existingAsset.id))
            .returning({
              id: assetTable.id,
            })
        : await db
            .insert(assetTable)
            .values({
              workspaceId: taskContext.workspaceId,
              projectId: taskContext.projectId,
              taskId: taskContext.taskId,
              objectKey: normalizedKey,
              filename,
              mimeType: contentType,
              size,
              kind: isImageContentType(contentType) ? "image" : "attachment",
              surface,
              createdBy: userId || null,
            })
            .returning({
              id: assetTable.id,
            });

      return c.json({
        id: asset.id,
        url: new URL(`/api/asset/${asset.id}`, c.req.url).toString(),
      });
    },
  )
  .put(
    "/description/:id",
    describeRoute({
      operationId: "updateTaskDescription",
      tags: ["Tasks"],
      description: "Update only the description of a task",
      responses: {
        200: {
          description: "Task description updated successfully",
          content: {
            "application/json": { schema: resolver(taskSchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator("json", v.object({ description: v.string() })),
    workspaceAccess.fromTask(),
    async (c) => {
      const { id } = c.req.valid("param");
      const { description } = c.req.valid("json");
      const currentUserId = c.get("userId");

      const task = await updateTaskDescription({
        id,
        description,
        currentUserId,
      });

      return c.json(task);
    },
  );

export default task;

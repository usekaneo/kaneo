import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { auth } from "../auth";
import { publishEvent } from "../events";
import { taskSchema } from "../schemas";
import createTask from "./controllers/create-task";
import deleteTask from "./controllers/delete-task";
import exportTasks from "./controllers/export-tasks";
import getTask from "./controllers/get-task";
import getTasks from "./controllers/get-tasks";
import importTasks from "./controllers/import-tasks";
import updateTask from "./controllers/update-task";
import updateTaskAssignee from "./controllers/update-task-assignee";
import updateTaskDescription from "./controllers/update-task-description";
import updateTaskDueDate from "./controllers/update-task-due-date";
import updateTaskPriority from "./controllers/update-task-priority";
import updateTaskStatus from "./controllers/update-task-status";
import updateTaskTitle from "./controllers/update-task-title";

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
    async (c) => {
      const { projectId } = c.req.valid("param");

      const tasks = await getTasks(projectId);

      return c.json(tasks);
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
        dueDate: v.optional(v.string()),
        priority: v.string(),
        status: v.string(),
        userId: v.optional(v.string()),
      }),
    ),
    async (c) => {
      const { projectId } = c.req.param();
      const { title, description, dueDate, priority, status, userId } =
        c.req.valid("json");

      const task = await createTask({
        projectId,
        userId,
        title,
        description,
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
    async (c) => {
      const { id } = c.req.valid("param");

      const task = await getTask(id);

      return c.json(task);
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
        dueDate: v.optional(v.string()),
        priority: v.string(),
        status: v.string(),
        projectId: v.string(),
        position: v.number(),
        userId: v.optional(v.string()),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid("param");
      const {
        title,
        description,
        dueDate,
        priority,
        status,
        projectId,
        position,
        userId,
      } = c.req.valid("json");

      const task = await updateTask(
        id,
        title,
        status,
        dueDate ? new Date(dueDate) : undefined,
        projectId,
        description,
        priority,
        position,
        userId,
      );

      if (status !== task.status) {
        const user = c.get("userId");
        await publishEvent("task.status_changed", {
          taskId: task.id,
          userId: user,
          oldStatus: task.status,
          newStatus: status,
          title: task.title,
          type: "status_changed",
        });
      }

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
            dueDate: v.optional(v.string()),
            userId: v.optional(v.nullable(v.string())),
          }),
        ),
      }),
    ),
    async (c) => {
      const { projectId } = c.req.valid("param");
      const { tasks } = c.req.valid("json");

      const result = await importTasks(projectId, tasks);

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
    async (c) => {
      const { id } = c.req.valid("param");

      const task = await deleteTask(id);

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
    async (c) => {
      const { id } = c.req.valid("param");
      const { status } = c.req.valid("json");
      const user = c.get("userId");

      const task = await updateTaskStatus({ id, status });

      await publishEvent("task.status_changed", {
        taskId: task.id,
        userId: user,
        oldStatus: task.status,
        newStatus: status,
        title: task.title,
        type: "status_changed",
      });

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
    validator("json", v.object({ priority: v.string() })),
    async (c) => {
      const { id } = c.req.valid("param");
      const { priority } = c.req.valid("json");
      const user = c.get("userId");

      const task = await updateTaskPriority({ id, priority });

      await publishEvent("task.priority_changed", {
        taskId: task.id,
        userId: user,
        oldPriority: task.priority,
        newPriority: priority,
        title: task.title,
        type: "priority_changed",
      });

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
    async (c) => {
      const { id } = c.req.valid("param");
      const { userId } = c.req.valid("json");
      const user = c.get("userId");

      const task = await updateTaskAssignee({ id, userId });

      const members = await auth.api.listMembers({
        headers: c.req.header(),
      });

      const newAssigneeName = members.members.find(
        (member) => member.userId === userId,
      )?.user?.name;

      if (!userId) {
        await publishEvent("task.unassigned", {
          taskId: task.id,
          userId: user,
          title: task.title,
          type: "unassigned",
        });
        return c.json(task);
      }

      await publishEvent("task.assignee_changed", {
        taskId: task.id,
        userId: user,
        oldAssignee: task.userId,
        newAssignee: newAssigneeName,
        title: task.title,
        type: "assignee_changed",
      });

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
    validator("json", v.object({ dueDate: v.string() })),
    async (c) => {
      const { id } = c.req.valid("param");
      const { dueDate } = c.req.valid("json");
      const user = c.get("userId");

      const task = await updateTaskDueDate({ id, dueDate: new Date(dueDate) });

      await publishEvent("task.due_date_changed", {
        taskId: task.id,
        userId: user,
        oldDueDate: task.dueDate,
        newDueDate: dueDate,
        title: task.title,
        type: "due_date_changed",
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
    async (c) => {
      const { id } = c.req.valid("param");
      const { title } = c.req.valid("json");
      const user = c.get("userId");

      const task = await updateTaskTitle({ id, title });

      await publishEvent("task.title_changed", {
        taskId: task.id,
        userId: user,
        oldTitle: task.title,
        newTitle: title,
        title: task.title,
        type: "title_changed",
      });

      return c.json(task);
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
    async (c) => {
      const { id } = c.req.valid("param");
      const { description } = c.req.valid("json");
      const user = c.get("userId");

      const task = await updateTaskDescription({ id, description });

      await publishEvent("task.description_changed", {
        taskId: task.id,
        userId: user,
        title: task.title,
        type: "description_changed",
      });

      return c.json(task);
    },
  );

export default task;

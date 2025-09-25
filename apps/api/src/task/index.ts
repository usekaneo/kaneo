import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { auth } from "../auth";
import { publishEvent } from "../events";
import createTask from "./controllers/create-task";
import deleteTask from "./controllers/delete-task";
import exportTasks from "./controllers/export-tasks";
import getTask from "./controllers/get-task";
import getTasks from "./controllers/get-tasks";
import importTasks from "./controllers/import-tasks";
import updateTask from "./controllers/update-task";
import updateTaskAssignee from "./controllers/update-task-assignee";
import updateTaskPriority from "./controllers/update-task-priority";
import updateTaskStatus from "./controllers/update-task-status";

const task = new Hono<{
  Variables: {
    userId: string;
  };
}>()
  .get(
    "/tasks/:projectId",
    zValidator("param", z.object({ projectId: z.string() })),
    async (c) => {
      const { projectId } = c.req.valid("param");

      const tasks = await getTasks(projectId);

      return c.json(tasks);
    },
  )
  .post(
    "/:projectId",
    zValidator(
      "json",
      z.object({
        title: z.string(),
        description: z.string(),
        dueDate: z.string(),
        priority: z.string(),
        status: z.string(),
        userId: z.string().optional(),
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
        dueDate: new Date(dueDate),
        priority,
        status,
      });

      return c.json(task);
    },
  )
  .get("/:id", zValidator("param", z.object({ id: z.string() })), async (c) => {
    const { id } = c.req.valid("param");

    const task = await getTask(id);

    return c.json(task);
  })
  .put(
    "/:id",
    zValidator("param", z.object({ id: z.string() })),
    zValidator(
      "json",
      z.object({
        title: z.string(),
        description: z.string(),
        dueDate: z.string(),
        priority: z.string(),
        status: z.string(),
        projectId: z.string(),
        position: z.number(),
        userId: z.string().optional(),
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
        new Date(dueDate),
        projectId,
        description,
        priority,
        position,
        userId,
      );

      return c.json(task);
    },
  )
  .get(
    "/export/:projectId",
    zValidator("param", z.object({ projectId: z.string() })),
    async (c) => {
      const { projectId } = c.req.valid("param");

      const exportData = await exportTasks(projectId);

      return c.json(exportData);
    },
  )
  .post(
    "/import/:projectId",
    zValidator("param", z.object({ projectId: z.string() })),
    zValidator(
      "json",
      z.object({
        tasks: z.array(
          z.object({
            title: z.string(),
            description: z.string().optional(),
            status: z.string(),
            priority: z.string().optional(),
            dueDate: z.string().optional(),
            userId: z.string().nullable().optional(),
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
    zValidator("param", z.object({ id: z.string() })),
    async (c) => {
      const { id } = c.req.valid("param");

      const task = await deleteTask(id);

      return c.json(task);
    },
  )
  .put(
    "/status/:id",
    zValidator("param", z.object({ id: z.string() })),
    zValidator("json", z.object({ status: z.string() })),
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
    zValidator("param", z.object({ id: z.string() })),
    zValidator("json", z.object({ priority: z.string() })),
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
    zValidator("param", z.object({ id: z.string() })),
    zValidator("json", z.object({ userId: z.string() })),
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
  );

export default task;

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import createTask from "./controllers/create-task";
import getTask from "./controllers/get-task";
import getTasks from "./controllers/get-tasks";
import updateTask from "./controllers/update-task";

const task = new Hono<{
  Variables: {
    userEmail: string;
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
        userEmail: z.string().nullable(),
      }),
    ),
    async (c) => {
      const { projectId } = c.req.param();
      const { title, description, dueDate, priority, status, userEmail } =
        c.req.valid("json");

      const task = await createTask({
        projectId,
        userEmail,
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
        userEmail: z.string().nullable(),
        position: z.number(),
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
        userEmail,
        position,
      } = c.req.valid("json");

      const task = await updateTask(
        id,
        userEmail ?? "",
        title,
        status,
        new Date(dueDate),
        description,
        priority,
        position,
      );

      return c.json(task);
    },
  );

export default task;

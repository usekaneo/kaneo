import Elysia, { t } from "elysia";

import createTask from "./controllers/create-task";
import getTask from "./controllers/get-task";
import getTasks from "./controllers/get-tasks";
import updateTask from "./controllers/update-task";

const task = new Elysia({ prefix: "/task" })
  .post(
    "/create",
    async ({ body }) => {
      const createdTask = await createTask(body);
      return createdTask;
    },
    {
      body: t.Object({
        projectId: t.String(),
        userEmail: t.String(),
        title: t.String(),
        status: t.String(),
        dueDate: t.Date(),
        description: t.String(),
        priority: t.String(),
        position: t.Number(),
      }),
    },
  )
  .get(
    "/:taskId",
    async ({ params }) => {
      const task = await getTask(params.taskId);
      return task;
    },
    {
      params: t.Object({
        taskId: t.String(),
      }),
    },
  )
  .get(
    "/list/:projectId",
    async ({ params }) => {
      const tasks = await getTasks(params.projectId);
      return tasks;
    },
    {
      params: t.Object({
        projectId: t.String(),
      }),
    },
  )
  .put(
    "/:taskId/update",
    async ({ params, body }) => {
      const updatedTask = await updateTask(params.taskId, body);
      return updatedTask;
    },
    {
      body: t.Object({
        projectId: t.String(),
        userEmail: t.String(),
        title: t.String(),
        status: t.String(),
        dueDate: t.Date(),
        description: t.String(),
        priority: t.String(),
        position: t.Number(),
      }),
    },
  );

export default task;

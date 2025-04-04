import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { subscribeToEvent } from "../events";
import createActivity from "./controllers/create-activity";
import createComment from "./controllers/create-comment";
import getActivitiesFromTaskId from "./controllers/get-activities";

const activity = new Hono()
  .get(
    "/:taskId",
    zValidator("param", z.object({ taskId: z.string() })),
    async (c) => {
      const { taskId } = c.req.valid("param");

      const activities = await getActivitiesFromTaskId(taskId);

      return c.json(activities);
    },
  )
  .post(
    "/create",
    zValidator(
      "json",
      z.object({
        taskId: z.string(),
        type: z.string(),
        userEmail: z.string(),
        content: z.string(),
      }),
    ),
    async (c) => {
      const { taskId, type, userEmail, content } = c.req.valid("json");

      const activity = await createActivity(taskId, type, userEmail, content);

      return c.json(activity);
    },
  )
  .post(
    "/comment",
    zValidator(
      "json",
      z.object({
        taskId: z.string(),
        content: z.string(),
        userEmail: z.string(),
      }),
    ),
    async (c) => {
      const { taskId, content, userEmail } = c.req.valid("json");

      const activity = await createComment(taskId, userEmail, content);

      return c.json(activity);
    },
  );

subscribeToEvent(
  "task.created",
  async ({
    taskId,
    userEmail,
    type,
    content,
  }: {
    taskId: string;
    userEmail: string;
    type: string;
    content: string;
  }) => {
    if (!userEmail || !taskId || !type || !content) {
      return;
    }

    await createActivity(taskId, type, userEmail, content);
  },
);

export default activity;

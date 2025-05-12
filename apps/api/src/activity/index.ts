import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { subscribeToEvent } from "../events";
import createActivity from "./controllers/create-activity";
import createComment from "./controllers/create-comment";
import deleteComment from "./controllers/delete-comment";
import getActivitiesFromTaskId from "./controllers/get-activities";
import updateComment from "./controllers/update-comment";
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
  )
  .put(
    "/comment",
    zValidator(
      "json",
      z.object({
        id: z.string(),
        content: z.string(),
        userEmail: z.string(),
      }),
    ),
    async (c) => {
      const { id, content, userEmail } = c.req.valid("json");

      const activity = await updateComment(userEmail, id, content);

      return c.json(activity);
    },
  )
  .delete(
    "/comment",
    zValidator(
      "json",
      z.object({
        id: z.string(),
        userEmail: z.string(),
      }),
    ),
    async (c) => {
      const { id, userEmail } = c.req.valid("json");

      await deleteComment(userEmail, id);

      return c.json({ message: "Comment deleted" });
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

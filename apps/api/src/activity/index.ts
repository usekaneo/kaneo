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
        userId: z.string(),
        content: z.string(),
      }),
    ),
    async (c) => {
      const { taskId, type, userId, content } = c.req.valid("json");

      const activity = await createActivity(taskId, type, userId, content);

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
        userId: z.string(),
      }),
    ),
    async (c) => {
      const { taskId, content, userId } = c.req.valid("json");

      const activity = await createComment(taskId, userId, content);

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
        userId: z.string(),
      }),
    ),
    async (c) => {
      const { id, content, userId } = c.req.valid("json");

      const activity = await updateComment(userId, id, content);

      return c.json(activity);
    },
  )
  .delete(
    "/comment",
    zValidator(
      "json",
      z.object({
        id: z.string(),
        userId: z.string(),
      }),
    ),
    async (c) => {
      const { id, userId } = c.req.valid("json");

      await deleteComment(userId, id);

      return c.json({ message: "Comment deleted" });
    },
  );

subscribeToEvent(
  "task.created",
  async ({
    taskId,
    userId,
    type,
    content,
  }: {
    taskId: string;
    userId: string;
    type: string;
    content: string;
  }) => {
    if (!userId || !taskId || !type || !content) {
      return;
    }

    await createActivity(taskId, type, userId, content);
  },
);

export default activity;

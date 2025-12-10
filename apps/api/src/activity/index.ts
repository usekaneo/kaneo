import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import createActivity from "./controllers/create-activity";
import createComment from "./controllers/create-comment";
import deleteComment from "./controllers/delete-comment";
import getActivities from "./controllers/get-activities";
import updateComment from "./controllers/update-comment";

const activity = new Hono<{
  Variables: {
    userId: string;
  };
}>()
  .get(
    "/:taskId",
    describeRoute({
      operationId: "getActivities",
      tags: ["Activity"],
      description: "Get all activities for a specific task",
      responses: {
        200: {
          description: "List of activities for the task",
          content: {
            "application/json": { schema: resolver(v.array(v.any())) },
          },
        },
      },
    }),
    validator("param", v.object({ taskId: v.string() })),
    async (c) => {
      const { taskId } = c.req.valid("param");
      const activities = await getActivities(taskId);
      return c.json(activities);
    },
  )
  .post(
    "/create",
    describeRoute({
      operationId: "createActivity",
      tags: ["Activity"],
      description: "Create a new activity (system-generated event)",
      responses: {
        200: {
          description: "Activity created successfully",
          content: {
            "application/json": { schema: resolver(v.any()) },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        taskId: v.string(),
        userId: v.string(),
        message: v.string(),
        type: v.string(),
      }),
    ),
    async (c) => {
      const { taskId, userId, message, type } = c.req.valid("json");
      const activity = await createActivity(taskId, userId, message, type);
      return c.json(activity);
    },
  )
  .post(
    "/comment",
    describeRoute({
      operationId: "createComment",
      tags: ["Activity"],
      description: "Create a new comment on a task",
      responses: {
        200: {
          description: "Comment created successfully",
          content: {
            "application/json": { schema: resolver(v.any()) },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        taskId: v.string(),
        comment: v.string(),
      }),
    ),
    async (c) => {
      const { taskId, comment } = c.req.valid("json");
      const userId = c.get("userId");
      const newComment = await createComment(taskId, userId, comment);
      return c.json(newComment);
    },
  )
  .put(
    "/comment",
    describeRoute({
      operationId: "updateComment",
      tags: ["Activity"],
      description: "Update an existing comment",
      responses: {
        200: {
          description: "Comment updated successfully",
          content: {
            "application/json": { schema: resolver(v.any()) },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        activityId: v.string(),
        comment: v.string(),
      }),
    ),
    async (c) => {
      const { activityId, comment } = c.req.valid("json");
      const updatedComment = await updateComment(activityId, comment);
      return c.json(updatedComment);
    },
  )
  .delete(
    "/comment",
    describeRoute({
      operationId: "deleteComment",
      tags: ["Activity"],
      description: "Delete a comment",
      responses: {
        200: {
          description: "Comment deleted successfully",
          content: {
            "application/json": { schema: resolver(v.any()) },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        activityId: v.string(),
      }),
    ),
    async (c) => {
      const { activityId } = c.req.valid("json");
      const deletedComment = await deleteComment(activityId);
      return c.json(deletedComment);
    },
  );

export default activity;

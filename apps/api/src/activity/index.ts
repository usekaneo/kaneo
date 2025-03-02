import Elysia, { t } from "elysia";
import createActivity from "./controllers/create-activity";
import createComment from "./controllers/create-comment";
import getActivitiesFromTaskId from "./controllers/get-activities";
import "./events";

const activity = new Elysia({ prefix: "/activity" })
  .get("/list/:taskId", async ({ params }) => {
    const activities = await getActivitiesFromTaskId(params.taskId);
    return activities;
  })
  .post(
    "/create",
    async ({ body }) => {
      const activity = await createActivity(body);
      return activity;
    },
    {
      body: t.Object({
        taskId: t.String(),
        type: t.String(),
        userEmail: t.String(),
        content: t.String(),
      }),
    },
  )
  .post(
    "/comment",
    async ({ body }) => {
      const activity = await createComment(body);
      return activity;
    },
    {
      body: t.Object({
        taskId: t.String(),
        content: t.String(),
        userEmail: t.String(),
      }),
    },
  );

export default activity;

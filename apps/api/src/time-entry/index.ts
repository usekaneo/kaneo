import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import createTimeEntry from "./controllers/create-time-entry";
import getTimeEntriesByTaskId from "./controllers/get-time-entries";
import getTimeEntry from "./controllers/get-time-entry";
import updateTimeEntry from "./controllers/update-time-entry";

const timeEntry = new Hono<{
  Variables: {
    userId: string;
  };
}>()
  .get(
    "/task/:taskId",
    zValidator("param", z.object({ taskId: z.string() })),
    async (c) => {
      const { taskId } = c.req.valid("param");
      const timeEntries = await getTimeEntriesByTaskId(taskId);
      return c.json(timeEntries);
    },
  )
  .get("/:id", zValidator("param", z.object({ id: z.string() })), async (c) => {
    const { id } = c.req.valid("param");
    const timeEntry = await getTimeEntry(id);
    return c.json(timeEntry);
  })
  .post(
    "/",
    zValidator(
      "json",
      z.object({
        taskId: z.string(),
        description: z.string().optional(),
        startTime: z.string(),
      }),
    ),
    async (c) => {
      const { taskId, description, startTime } = c.req.valid("json");
      const userId = c.get("userId");

      const timeEntry = await createTimeEntry({
        taskId,
        userId,
        description,
        startTime: new Date(startTime),
      });

      return c.json(timeEntry);
    },
  )
  .put(
    "/:id",
    zValidator("param", z.object({ id: z.string() })),
    zValidator(
      "json",
      z.object({
        endTime: z.string(),
        duration: z.number(),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid("param");
      const { endTime, duration } = c.req.valid("json");

      const timeEntry = await updateTimeEntry(id, new Date(endTime), duration);

      return c.json(timeEntry);
    },
  );

export default timeEntry;

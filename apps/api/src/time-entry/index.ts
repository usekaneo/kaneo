import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { timeEntrySchema } from "../schemas";
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
    describeRoute({
      operationId: "getTaskTimeEntries",
      tags: ["Time Entries"],
      description: "Get all time entries for a specific task",
      responses: {
        200: {
          description: "List of time entries for the task",
          content: {
            "application/json": { schema: resolver(v.array(timeEntrySchema)) },
          },
        },
      },
    }),
    validator("param", v.object({ taskId: v.string() })),
    async (c) => {
      const { taskId } = c.req.valid("param");
      const timeEntries = await getTimeEntriesByTaskId(taskId);
      return c.json(timeEntries);
    },
  )
  .get(
    "/:id",
    describeRoute({
      operationId: "getTimeEntry",
      tags: ["Time Entries"],
      description: "Get a specific time entry by ID",
      responses: {
        200: {
          description: "Time entry details",
          content: {
            "application/json": { schema: resolver(timeEntrySchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    async (c) => {
      const { id } = c.req.valid("param");
      const timeEntry = await getTimeEntry(id);
      return c.json(timeEntry);
    },
  )
  .post(
    "/",
    describeRoute({
      operationId: "createTimeEntry",
      tags: ["Time Entries"],
      description: "Create a new time entry for a task",
      responses: {
        200: {
          description: "Time entry created successfully",
          content: {
            "application/json": { schema: resolver(timeEntrySchema) },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        taskId: v.string(),
        startTime: v.string(),
        endTime: v.optional(v.string()),
        description: v.optional(v.string()),
      }),
    ),
    async (c) => {
      const { taskId, startTime, endTime, description } = c.req.valid("json");
      const userId = c.get("userId");
      const timeEntry = await createTimeEntry({
        taskId,
        userId,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : undefined,
        description,
      });
      return c.json(timeEntry);
    },
  )
  .put(
    "/:id",
    describeRoute({
      operationId: "updateTimeEntry",
      tags: ["Time Entries"],
      description: "Update an existing time entry",
      responses: {
        200: {
          description: "Time entry updated successfully",
          content: {
            "application/json": { schema: resolver(timeEntrySchema) },
          },
        },
      },
    }),
    validator("param", v.object({ id: v.string() })),
    validator(
      "json",
      v.object({
        startTime: v.string(),
        endTime: v.optional(v.string()),
        description: v.optional(v.string()),
      }),
    ),
    async (c) => {
      const { id } = c.req.valid("param");
      const { startTime, endTime, description } = c.req.valid("json");
      const timeEntry = await updateTimeEntry({
        timeEntryId: id,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : undefined,
        description,
      });
      return c.json(timeEntry);
    },
  );

export default timeEntry;

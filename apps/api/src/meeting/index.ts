import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import {
  createMeetingBooking,
  getMeetingBookingForTask,
} from "./controllers/meeting-actions";

const bookingSchema = v.object({
  id: v.string(),
  taskId: v.string(),
  kind: v.string(),
  status: v.string(),
  title: v.nullable(v.string()),
  notes: v.nullable(v.string()),
  calBookingId: v.nullable(v.string()),
  calBookingUid: v.nullable(v.string()),
  eventTypeId: v.nullable(v.string()),
  eventTypeSlug: v.nullable(v.string()),
  schedulingUrl: v.nullable(v.string()),
  meetingUrl: v.nullable(v.string()),
  attendees: v.nullable(v.array(v.record(v.string(), v.unknown()))),
  startsAt: v.nullable(v.date()),
  endsAt: v.nullable(v.date()),
  createdBy: v.nullable(v.string()),
  createdAt: v.date(),
  updatedAt: v.date(),
});

const meeting = new Hono<{
  Variables: {
    userId: string;
    workspaceId: string;
  };
}>()
  .get(
    "/:taskId",
    describeRoute({
      operationId: "getMeetingBooking",
      tags: ["Meetings"],
      description: "Get Cal.com booking for a task",
      responses: {
        200: {
          description: "Meeting booking or null",
          content: {
            "application/json": {
              schema: resolver(v.nullable(bookingSchema)),
            },
          },
        },
      },
    }),
    validator("param", v.object({ taskId: v.string() })),
    workspaceAccess.fromTaskId("taskId"),
    async (c) => {
      const { taskId } = c.req.valid("param");
      const booking = await getMeetingBookingForTask(taskId);
      return c.json(booking);
    },
  )
  .post(
    "/",
    describeRoute({
      operationId: "createMeetingBooking",
      tags: ["Meetings"],
      description: "Create or update a scheduling link for a task",
      responses: {
        200: {
          description: "Meeting booking",
          content: {
            "application/json": { schema: resolver(bookingSchema) },
          },
        },
      },
    }),
    validator(
      "json",
      v.object({
        workspaceId: v.string(),
        taskId: v.string(),
        title: v.optional(v.string()),
        schedulingUrl: v.string(),
      }),
    ),
    workspaceAccess.fromBody(),
    async (c) => {
      const { taskId, title, schedulingUrl } = c.req.valid("json");
      const userId = c.get("userId");

      const booking = await createMeetingBooking({
        taskId,
        title,
        schedulingUrl,
        createdBy: userId,
      });

      return c.json(booking);
    },
  );

export default meeting;

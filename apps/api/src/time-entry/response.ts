import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";

export const timeEntrySchema = z
  .object({
    id: z.string(),
    taskId: z.string(),
    userId: z.string().nullable().openapi({
      description: "Null once the user who logged the time has been removed.",
    }),
    description: z.string().nullable(),
    billable: z.boolean().openapi({
      description: "Whether the time is billable.",
    }),
    startTime: responseTimestamp,
    endTime: nullableResponseTimestamp.openapi({
      description: "Null while the timer is still running.",
    }),
    duration: z.number().nullable().openapi({
      description: "Elapsed seconds, filled in once the entry has an endTime.",
    }),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("TimeEntry");

export const timeEntryListSchema = z.array(
  timeEntrySchema
    .extend({ userName: z.string().nullable() })
    .openapi("TimeEntryWithUser"),
);

// Built from the base shape instead of .extend() so the emitted schema is
// a plain nullable object. An extended schema renders as an allOf
// intersection, which a sidecar nullability annotation does not open up,
// and this route legitimately returns null.
export const runningTimeEntrySchema = z
  .object({
    ...timeEntrySchema.shape,
    taskTitle: z.string().nullable().openapi({
      description: "Title of the task being tracked.",
    }),
    projectId: z.string().openapi({
      description: "Project the tracked task belongs to.",
    }),
    workspaceId: z.string().openapi({
      description: "Workspace the tracked task belongs to.",
    }),
  })
  .openapi("RunningTimeEntry");

export const startTimeEntryResultSchema = z
  .object({
    entry: timeEntrySchema.openapi({
      description:
        "The running entry. A retried start returns the existing one.",
    }),
    stoppedEntryId: z.string().nullable().openapi({
      description:
        "The previously running entry that was auto-stopped, if it was kept.",
    }),
    stoppedTaskId: z.string().nullable().openapi({
      description: "The task the auto-stopped entry belonged to, if kept.",
    }),
    discardedEntryId: z.string().nullable().openapi({
      description:
        "The previously running entry that was discarded for being under 3 seconds old.",
    }),
    discardedTaskId: z.string().nullable().openapi({
      description: "The task the discarded entry belonged to, if any.",
    }),
  })
  .openapi("StartTimeEntryResult");

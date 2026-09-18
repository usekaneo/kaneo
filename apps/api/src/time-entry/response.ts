import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";

export const timeEntrySchema = z
  .object({
    id: z.string(),
    taskId: z.string(),
    userId: z.string().nullable().openapi({
      description: "Null once the user who logged the time has been removed.",
    }),
    description: z.string().nullable(),
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

export const timeEntryDetailSchema = timeEntrySchema
  .extend({
    userName: z.string().nullable(),
    taskTitle: z.string(),
    taskNumber: z.number().nullable(),
    projectId: z.string(),
    projectName: z.string(),
    projectSlug: z.string(),
  })
  .openapi("TimeEntryDetail");

export const timeEntryDetailListSchema = z.array(timeEntryDetailSchema);

export const runningTimeEntrySchema = timeEntryDetailSchema
  .nullable()
  .openapi("RunningTimeEntry");

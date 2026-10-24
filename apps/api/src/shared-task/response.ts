import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";

export const taskShareSchema = z
  .object({
    taskId: z.string(),
    token: z.string(),
    createdAt: responseTimestamp,
  })
  .openapi("TaskShare");

export const taskShareStateSchema = z
  .object({ share: taskShareSchema.nullable() })
  .openapi("TaskShareState");

export const sharedTaskSchema = z
  .object({
    ticketKey: z.string(),
    title: z.string(),
    status: z.object({
      slug: z.string(),
      name: z.string().nullable(),
      icon: z.string().nullable(),
      isFinal: z.boolean(),
    }),
    description: z.string().nullable(),
    descriptionDeferred: z.boolean(),
    priority: z.string(),
    assigneeName: z.string().nullable(),
    startDate: nullableResponseTimestamp,
    dueDate: nullableResponseTimestamp,
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("SharedTask");

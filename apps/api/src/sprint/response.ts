import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";

const sprintStatus = z
  .enum(["future", "active", "closed"])
  .openapi({
    description:
      "Future sprints can be edited, reordered and started. Exactly one sprint per project may be active. Closed sprints are immutable and keep their completed tasks as history.",
  });

export const sprintSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    name: z.string(),
    goal: z.string().nullable(),
    status: sprintStatus,
    startDate: nullableResponseTimestamp,
    endDate: nullableResponseTimestamp,
    carryOverTasks: z
      .array(z.object({ id: z.string(), title: z.string() }))
      .nullable()
      .openapi({
        description:
          "Unfinished tasks moved out when the sprint was closed, frozen as a snapshot at close time. Null while the sprint is open.",
      }),
    position: z.number().openapi({
      description: "Backlog order, ascending. Sprints are always returned sorted by it.",
    }),
    taskCount: z
      .number()
      .openapi({ description: "Tasks currently assigned to this sprint." }),
    completedTaskCount: z
      .number()
      .openapi({
        description:
          "Tasks assigned to this sprint that sit in a final column. After a sprint closes, these remain as its history.",
      }),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("Sprint");

export const sprintListSchema = z.array(sprintSchema);

export const closeSprintResultSchema = z
  .object({
    sprint: sprintSchema,
    movedTaskIds: z
      .array(z.string())
      .openapi({ description: "Unfinished tasks that were moved to the target." }),
    targetSprintId: z
      .string()
      .nullable()
      .openapi({ description: "The sprint that received the unfinished tasks; null means backlog." }),
  })
  .openapi("CloseSprintResult");

export const taskSprintSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    sprintId: z
      .string()
      .nullable()
      .openapi({ description: "Null means the task sits in the backlog." }),
  })
  .openapi("TaskSprint");

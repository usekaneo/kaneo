import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";
import { boardColumnSchema, boardTaskSchema } from "../task/response";

export const projectSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    slug: z.string().openapi({
      description: "Short prefix used in task identifiers, e.g. KAN-12.",
    }),
    icon: z.string().nullable(),
    name: z.string(),
    description: z.string().nullable(),
    createdAt: responseTimestamp,
    isPublic: z.boolean().nullable().openapi({
      description:
        "When true the project's board is readable without signing in, via /api/public-project/{id}.",
    }),
    archivedAt: nullableResponseTimestamp.openapi({
      description:
        "Non-null once archived; archived projects are hidden by default.",
    }),
    position: z.number().openapi({ description: "Sidebar order, ascending." }),
    lastTaskNumber: z.number().openapi({
      description:
        "Highest task number issued in this project; the next task gets this plus one.",
    }),
  })
  .openapi("Project");

export const projectStatisticsSchema = z
  .object({
    completionPercentage: z.number(),
    totalTasks: z.number(),
    dueDate: nullableResponseTimestamp.openapi({
      description: "The soonest due date among the project's open tasks.",
    }),
    nextDueDate: nullableResponseTimestamp.openapi({
      description: "The soonest due date among open tasks only.",
    }),
    openTasks: z.number(),
    completedTasks: z.number(),
    overdueTasks: z.number().openapi({
      description: "Open tasks whose due date has passed.",
    }),
    dueThisWeekTasks: z.number().openapi({
      description: "Open tasks due in the next 7 days.",
    }),
    estimateMinutes: z.number().openapi({
      description: "Sum of the tasks' estimates.",
    }),
    trackedSecondsLast30Days: z.number().openapi({
      description:
        "Finished time entries on the project's tasks, last 30 days.",
    }),
    assigneeIds: z.array(z.string()).openapi({
      description: "People assigned to the project's open tasks.",
    }),
    lastActivityAt: nullableResponseTimestamp.openapi({
      description: "When any of the project's tasks last changed.",
    }),
  })
  .openapi("ProjectStatistics");

export const projectListItemSchema = projectSchema
  .extend({
    statistics: projectStatisticsSchema,
    // Legacy, always empty. Fetch the board via GET /task/tasks/{id}.
    archivedTasks: z
      .array(boardTaskSchema)
      .openapi({ description: "Always empty." }),
    plannedTasks: z
      .array(boardTaskSchema)
      .openapi({ description: "Always empty." }),
    columns: z
      .array(boardColumnSchema)
      .openapi({ description: "Always empty." }),
  })
  .openapi("ProjectListItem");

export const projectListSchema = z.array(projectListItemSchema);

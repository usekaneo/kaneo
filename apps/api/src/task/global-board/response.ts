import { nullableResponseTimestamp, z } from "../../openapi";
import { taskLabelSchema } from "../response";
import { GLOBAL_STATUSES } from "./global-status";

const globalStatusSchema = z.enum(GLOBAL_STATUSES).nullable().openapi({
  description:
    "Where the column sits on the global board. Null when it cannot be placed without guessing, such as a non-final column named Done.",
});

export const globalBoardMetaSchema = z
  .object({
    workspaces: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        canMoveTasks: z.boolean().openapi({
          description: "Whether the caller may change task status here.",
        }),
      }),
    ),
    projects: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        icon: z.string().nullable(),
        workspaceId: z.string(),
        columns: z.array(
          z.object({
            slug: z.string(),
            name: z.string(),
            icon: z.string().nullable(),
            isFinal: z.boolean(),
            position: z.number(),
            globalStatus: globalStatusSchema,
          }),
        ),
      }),
    ),
    assignees: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        image: z.string().nullable(),
      }),
    ),
    labels: z.array(z.object({ name: z.string(), color: z.string() })),
  })
  .openapi("GlobalBoardMeta");

export const globalBoardTasksSchema = z
  .object({
    tasks: z.array(
      z
        .object({
          id: z.string(),
          projectId: z.string(),
          number: z.number().nullable(),
          title: z.string(),
          status: z.string().openapi({
            description: "The slug of the project column the task sits in.",
          }),
          statusName: z.string().nullable(),
          statusIcon: z.string().nullable(),
          priority: z.string(),
          dueDate: nullableResponseTimestamp,
          projectName: z.string(),
          projectSlug: z.string(),
          projectIcon: z.string().nullable(),
          workspaceId: z.string(),
          workspaceName: z.string(),
          assignee: z
            .object({
              id: z.string(),
              name: z.string(),
              image: z.string().nullable(),
            })
            .nullable(),
          labels: z.array(taskLabelSchema),
        })
        .openapi("GlobalBoardTask"),
    ),
    pagination: z.object({
      page: z.number(),
      pageSize: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  })
  .openapi("GlobalBoardTasks");

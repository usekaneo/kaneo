import { columnSchema } from "../column/response";
import { z } from "../openapi";
import { boardTaskSchema } from "../task/response";

export const avatarSchema = z
  .object({
    id: z.string(),
    url: z.string().openapi({
      description:
        "Public URL for the stored avatar, served from /api/user/avatar/{id}.",
    }),
    size: z.number().openapi({ description: "Decoded size in bytes." }),
  })
  .openapi("UserAvatar");

export const avatarDeletedSchema = z
  .object({
    deleted: z.boolean().openapi({
      description: "False when the user had no uploaded avatar to remove.",
    }),
  })
  .openapi("UserAvatarDeleted");

export const currentUserSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    image: z.string().nullable(),
    role: z.string().nullable(),
  })
  .openapi("CurrentUser");

export const paginationSchema = z
  .object({
    total: z.number().openapi({
      description: "How many rows match in total, across all pages.",
    }),
    page: z.number(),
    pageSize: z.number(),
    totalPages: z.number().openapi({ description: "At least 1." }),
  })
  .openapi("Pagination");

export const assignedTaskProjectSchema = z
  .object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    icon: z.string().nullable(),
    position: z.number(),
    workspaceId: z.string(),
    workspaceName: z.string(),
    columns: z.array(
      columnSchema
        .pick({
          id: true,
          slug: true,
          name: true,
          icon: true,
          isFinal: true,
          position: true,
        })
        .openapi("AssignedTaskProjectColumn"),
    ),
  })
  .openapi("AssignedTaskProject");

export const assignedTasksSchema = z
  .object({
    data: z.object({
      tasks: z.array(boardTaskSchema).openapi({
        description:
          "Open tasks assigned to the current user, ordered by due date (tasks without one last). `status` is a column slug of the task's project.",
      }),
      projects: z.array(assignedTaskProjectSchema).openapi({
        description:
          "The projects those tasks belong to, with their columns, so clients can resolve statuses without extra requests.",
      }),
    }),
    pagination: paginationSchema,
  })
  .openapi("AssignedTasksResponse");

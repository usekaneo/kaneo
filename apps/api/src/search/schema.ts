import { z } from "../openapi";

export const searchQuery = z
  .object({
    q: z
      .string()
      .min(1, "Query must be at least 1 character")
      .max(512, "Query must not exceed 512 characters"),
    type: z
      .enum([
        "all",
        "tasks",
        "projects",
        "workspaces",
        "comments",
        "activities",
      ])
      .optional()
      .default("all"),
    workspaceId: z.string().min(1),
    projectId: z.string().optional(),
    subtaskOf: z.string().min(1).optional().openapi({
      description:
        "Only tasks eligible to become a child of this task. Requires type=tasks.",
    }),
    parentOf: z.string().min(1).optional().openapi({
      description:
        "Only tasks eligible to become a parent of this task. Requires type=tasks.",
    }),
    limit: z
      .string()
      .optional()
      .default("20")
      .transform(Number)
      .pipe(
        z
          .number()
          .int("Limit must be an integer")
          .min(1, "Limit must be at least 1")
          .max(50, "Limit must not exceed 50"),
      ),
    userEmail: z.email().optional(),
  })
  .refine(
    (query) =>
      !(query.subtaskOf && query.parentOf) &&
      (!(query.subtaskOf || query.parentOf) || query.type === "tasks"),
    {
      message: "Use only one of subtaskOf or parentOf, with type=tasks",
    },
  );

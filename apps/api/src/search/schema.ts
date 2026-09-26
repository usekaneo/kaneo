import { z } from "../openapi";

export const searchQuery = z.object({
  q: z
    .string()
    .min(1, "Query must be at least 1 character")
    .max(512, "Query must not exceed 512 characters"),
  type: z
    .enum(["all", "tasks", "projects", "workspaces", "comments", "activities"])
    .optional()
    .default("all"),
  workspaceId: z.string().min(1),
  projectId: z.string().optional(),
  excludeProjectId: z.string().optional().openapi({
    description:
      "Leave out results scoped to this project, e.g. to search other projects in the workspace for a cross-project picker. Ignored together with `projectId`.",
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
});

import { z } from "../openapi";

export const searchQuery = z.object({
  q: z.string().min(1, "Query must be at least 1 character"),
  type: z
    .enum(["all", "tasks", "projects", "workspaces", "comments", "activities"])
    .optional()
    .default("all"),
  workspaceId: z.string().min(1),
  projectId: z.string().optional(),
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

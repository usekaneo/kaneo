import { z } from "../openapi";
import { MAX_ASSIGNED_TASKS } from "../task/controllers/get-assigned-tasks";
import { pagingNumber } from "../task/schema";

export const listAssignedTasksQuery = z.object({
  page: pagingNumber(1, 1_000_000).optional(),
  limit: pagingNumber(1, MAX_ASSIGNED_TASKS).optional(),
});

export const uploadAvatarBody = z.object({
  contentType: z.string().openapi({
    description: "One of image/png, image/jpeg, or image/webp.",
    example: "image/png",
  }),
  data: z.string().openapi({ description: "Base64 encoded image bytes." }),
});

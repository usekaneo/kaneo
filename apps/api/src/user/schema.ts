import { pagingNumber, z } from "../openapi";
import { MAX_ASSIGNED_TASKS } from "../task/controllers/get-assigned-tasks";
import { MAX_AVATAR_INPUT_CHARS } from "./avatar";

export const listAssignedTasksQuery = z.object({
  page: pagingNumber(1, 1_000_000).optional(),
  limit: pagingNumber(1, MAX_ASSIGNED_TASKS).optional(),
});

export const uploadAvatarBody = z.object({
  contentType: z.string().max(64).openapi({
    description: "One of image/png, image/jpeg, or image/webp.",
    example: "image/png",
  }),
  data: z
    .string()
    .max(MAX_AVATAR_INPUT_CHARS)
    .openapi({ description: "Base64 encoded image bytes." }),
});

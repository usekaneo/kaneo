import { z } from "../openapi";
import { MAX_AVATAR_INPUT_CHARS } from "./avatar";

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

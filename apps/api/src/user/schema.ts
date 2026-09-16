import { z } from "../openapi";

export const uploadAvatarBody = z.object({
  contentType: z.string().openapi({
    description: "One of image/png, image/jpeg, or image/webp.",
    example: "image/png",
  }),
  data: z.string().openapi({ description: "Base64 encoded image bytes." }),
});

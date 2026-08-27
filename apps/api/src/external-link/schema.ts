import { z } from "../openapi";

export const taskIdParam = z.object({ taskId: z.string() });

export const createExternalLinkBody = z.object({
  url: z
    .string()
    .url()
    .refine(
      (url) => url.startsWith("http://") || url.startsWith("https://"),
      "URL must use http or https",
    ),
  title: z.string().max(200).optional(),
});

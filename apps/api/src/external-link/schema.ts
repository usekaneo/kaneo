import { z } from "../openapi";

export const taskIdParam = z.object({ taskId: z.string() });

export const createExternalLinkBody = z.object({
  url: z
    .string()
    .url()
    .refine((url) => /^https?:\/\//i.test(url), "URL must use http or https")
    .describe("An HTTP or HTTPS URL"),
  title: z.string().max(200).optional(),
});

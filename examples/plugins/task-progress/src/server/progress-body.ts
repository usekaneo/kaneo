import { z } from "zod";

export const progressBody = z.object({
  value: z.number().int().min(0).max(100),
});

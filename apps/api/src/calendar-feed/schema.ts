import { z } from "../openapi";

export const calendarFeedProjectParam = z.object({ projectId: z.string() });
export const calendarFeedTokenParam = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
});
export const calendarFeedDeleteParam = calendarFeedProjectParam.extend({
  id: z.string(),
});
export const createCalendarFeedBody = z.object({
  labelIds: z.array(z.string().min(1)).min(1).max(100),
  timeZone: z
    .string()
    .refine((value) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "Invalid time zone")
    .default("UTC"),
});

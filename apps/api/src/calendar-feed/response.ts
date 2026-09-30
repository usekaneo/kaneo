import { responseTimestamp, z } from "../openapi";

export const calendarFeedSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    token: z.string(),
    labelIds: z.array(z.string()),
    timeZone: z.string(),
    createdAt: responseTimestamp,
  })
  .openapi("CalendarFeed");

import type { getCalendarFeeds } from "@/fetchers/calendar-feed";

export type CalendarFeed = Awaited<ReturnType<typeof getCalendarFeeds>>[number];

import { z } from "../openapi";

export const workspaceIdParam = z.object({ workspaceId: z.string() });

export const holidayParam = z.object({
  workspaceId: z.string(),
  holidayId: z.string(),
});

export const updateWorkingDaysBody = z.object({
  // Bitmask, bit i (i = 0..6, 0 = Sunday) set means weekday i is working.
  // 0-127 covers every combination of the 7 weekday bits.
  workingDays: z.number().int().min(0).max(127),
});

export const createHolidayBody = z.object({
  // ISO date (or date-time) string; normalized server-side to UTC midnight.
  date: z.string().min(1),
  // Bounded so a holiday label can't be an unbounded blob on this new,
  // admin-writable surface; 120 chars is ample for a human-readable name.
  name: z.string().min(1).max(120),
});

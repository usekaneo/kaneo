import { calendarDay } from "../company/calendar-day";
import { z } from "../openapi";

// Minor units (e.g. paisa, cents). Large enough for any salary, small enough
// to stay an exact JavaScript number.
const money = z
  .number()
  .int()
  .min(0)
  .max(1_000_000_000_000)
  .openapi({ description: "Amount in minor units, e.g. 5000000 = 50,000.00" });

export const workspaceQuery = z.object({ workspaceId: z.string() });

export const personQuery = z.object({
  workspaceId: z.string(),
  userId: z.string().optional().openapi({
    description: "Defaults to you. Others need payroll:read.",
  }),
});

export const addSalaryBody = z.object({
  workspaceId: z.string(),
  userId: z.string(),
  amount: money,
  type: z.enum(["monthly", "hourly"]),
  effectiveFrom: calendarDay,
  note: z.string().max(500).optional(),
});

export const createRunBody = z.object({
  workspaceId: z.string(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

export const runParam = z.object({ id: z.string() });

export const itemParam = z.object({ id: z.string(), itemId: z.string() });

export const updateItemBody = z.object({
  workspaceId: z.string(),
  bonus: money,
  deduction: money,
  note: z.string().max(500).nullable().optional(),
});

export const workspaceBody = z.object({ workspaceId: z.string() });

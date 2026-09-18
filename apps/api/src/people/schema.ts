import { calendarDay } from "../company/calendar-day";
import { z } from "../openapi";

const clockTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM");

export const workspaceQuery = z.object({ workspaceId: z.string() });

export const personParam = z.object({ userId: z.string() });

export const setTaskOrderBody = z.object({
  workspaceId: z.string(),
  taskIds: z.array(z.string()).max(2000),
});

export const employeeStatus = z.enum(["active", "on_leave", "inactive"]);

// Every field is optional; null clears it (a cleared schedule field falls
// back to the company schedule).
export const updatePersonBody = z
  .object({
    workspaceId: z.string(),
    title: z.string().trim().max(120).nullable().optional(),
    departmentId: z.string().nullable().optional(),
    joinDate: calendarDay.nullable().optional(),
    status: employeeStatus.optional(),
    workDays: z
      .array(z.number().int().min(1).max(7))
      .min(1)
      .nullable()
      .optional(),
    workStart: clockTime.nullable().optional(),
    workEnd: clockTime.nullable().optional(),
    breakMinutes: z.number().int().min(0).max(240).nullable().optional(),
  })
  .refine((b) => !b.workStart || !b.workEnd || b.workEnd > b.workStart, {
    message: "The work day must end after it starts",
    path: ["workEnd"],
  });

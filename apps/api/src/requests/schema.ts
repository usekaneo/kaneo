import { calendarDay } from "../company/calendar-day";
import { z } from "../openapi";

export const workspaceQuery = z.object({ workspaceId: z.string() });

export const personQuery = z.object({
  workspaceId: z.string(),
  userId: z.string().optional().openapi({
    description: "Defaults to you. Others need request:approve.",
  }),
});

export const balanceQuery = personQuery.extend({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const idParam = z.object({ id: z.string() });

export const allExpensesQuery = z.object({
  workspaceId: z.string(),
  status: z.enum(["pending", "approved", "rejected", "paid"]).optional(),
  userId: z.string().optional(),
  from: calendarDay.optional().openapi({
    description: "Only expenses spent on or after this day.",
  }),
  to: calendarDay.optional().openapi({
    description: "Only expenses spent on or before this day.",
  }),
});

export const allLeaveQuery = z.object({
  workspaceId: z.string(),
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
  userId: z.string().optional(),
  from: calendarDay.optional().openapi({
    description: "Only leave that ends on or after this day.",
  }),
  to: calendarDay.optional().openapi({
    description: "Only leave that starts on or before this day.",
  }),
});

export const previewQuery = z
  .object({
    workspaceId: z.string(),
    startDate: calendarDay,
    endDate: calendarDay,
  })
  .refine((q) => q.endDate >= q.startDate, {
    message: "The last day can't be before the first",
    path: ["endDate"],
  });

export const leaveBody = z
  .object({
    workspaceId: z.string(),
    type: z.enum(["annual", "sick", "unpaid"]),
    startDate: calendarDay,
    endDate: calendarDay,
    reason: z.string().max(500).optional(),
  })
  .refine((b) => b.endDate >= b.startDate, {
    message: "The last day can't be before the first",
    path: ["endDate"],
  })
  .refine(
    (b) => (Date.parse(b.endDate) - Date.parse(b.startDate)) / 86_400_000 < 90,
    { message: "Request at most 90 days at a time", path: ["endDate"] },
  );

export const decideBody = z.object({
  workspaceId: z.string(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().max(500).optional(),
});

export const workspaceBody = z.object({ workspaceId: z.string() });

export const expenseBody = z.object({
  workspaceId: z.string(),
  amount: z
    .number()
    .int()
    .min(1)
    .max(100_000_000_00)
    .openapi({ description: "Minor units, e.g. 150000 = 1,500.00" }),
  category: z.string().trim().min(1).max(60),
  description: z.string().max(500).optional(),
  spentOn: calendarDay,
  projectId: z.string().optional(),
  receiptFileId: z.string().optional(),
});

export const receiptBody = z.object({
  workspaceId: z.string(),
  filename: z.string().trim().min(1).max(200),
  // ~5 MB of bytes is ~6.7 MB of base64.
  data: z.string().min(1).max(7_000_000).openapi({ description: "Base64" }),
});

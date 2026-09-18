import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";

export const leaveRequestSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    userName: z.string(),
    type: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    days: z.number(),
    reason: z.string().nullable(),
    status: z.string().openapi({
      description: "pending, approved, rejected or cancelled",
    }),
    decidedAt: nullableResponseTimestamp,
    decisionNote: z.string().nullable(),
    createdAt: responseTimestamp,
  })
  .openapi("LeaveRequest");

export const leaveRequestListSchema = z.array(leaveRequestSchema);

export const leaveHistorySchema = z
  .array(
    leaveRequestSchema.extend({
      decidedByName: z.string().nullable(),
    }),
  )
  .openapi("LeaveHistory");

export const leavePreviewSchema = z
  .object({
    days: z.number().openapi({ description: "Working days in the range." }),
  })
  .openapi("LeavePreview");

export const leaveBasicSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    days: z.number(),
    status: z.string(),
  })
  .openapi("LeaveRequestBasic");

export const leaveBalanceSchema = z
  .object({
    year: z.number(),
    allowance: z.number(),
    used: z.number(),
    pending: z.number(),
    available: z.number(),
  })
  .openapi("LeaveBalance");

export const expenseSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    userName: z.string(),
    amount: z.number(),
    currency: z.string(),
    category: z.string(),
    description: z.string().nullable(),
    spentOn: z.string(),
    projectId: z.string().nullable(),
    projectName: z.string().nullable(),
    receiptFileId: z.string().nullable(),
    receiptName: z.string().nullable(),
    status: z.string().openapi({
      description: "pending, approved, rejected or paid",
    }),
    decidedAt: nullableResponseTimestamp,
    paidAt: nullableResponseTimestamp,
    createdAt: responseTimestamp,
  })
  .openapi("Expense");

export const expenseListSchema = z.array(expenseSchema);

export const openRequestsSchema = z
  .object({ leave: leaveRequestListSchema, expenses: expenseListSchema })
  .openapi("OpenRequests");

export const storedFileSchema = z
  .object({
    id: z.string(),
    filename: z.string(),
    mimeType: z.string(),
    size: z.number(),
  })
  .openapi("StoredFile");

export const deletedSchema = z.object({ id: z.string() });

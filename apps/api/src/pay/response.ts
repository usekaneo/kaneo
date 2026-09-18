import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";

export const salarySchema = z
  .object({
    id: z.string(),
    amount: z.number(),
    type: z.string(),
    effectiveFrom: z.string(),
    note: z.string().nullable(),
    createdAt: responseTimestamp,
    createdByName: z.string().nullable(),
  })
  .openapi("Salary");

export const salaryListSchema = z.array(salarySchema);

export const currentSalaryListSchema = z
  .array(
    z.object({
      userId: z.string(),
      name: z.string(),
      amount: z.number().nullable(),
      type: z.string().nullable(),
      effectiveFrom: z.string().nullable(),
    }),
  )
  .openapi("CurrentSalaries");

const runFields = {
  id: z.string(),
  year: z.number(),
  month: z.number(),
  currency: z.string(),
  status: z.string().openapi({ description: "draft, approved or paid" }),
  approvedAt: nullableResponseTimestamp,
  paidAt: nullableResponseTimestamp,
  createdAt: responseTimestamp,
};

export const payrollRunSummarySchema = z
  .object({ ...runFields, people: z.number(), netTotal: z.number() })
  .openapi("PayrollRunSummary");

export const payrollRunListSchema = z.array(payrollRunSummarySchema);

export const payrollItemSchema = z
  .object({
    id: z.string(),
    userId: z.string().nullable(),
    employeeName: z.string(),
    salaryType: z.string(),
    salaryAmount: z.number(),
    workedMinutes: z.number(),
    overtimeMinutes: z.number(),
    baseAmount: z.number(),
    overtimeAmount: z.number(),
    bonus: z.number(),
    deduction: z.number(),
    netAmount: z.number(),
    note: z.string().nullable(),
  })
  .openapi("PayrollItem");

export const payrollRunSchema = z
  .object({ ...runFields, items: z.array(payrollItemSchema) })
  .openapi("PayrollRun");

export const payrollRunBasicSchema = z
  .object(runFields)
  .openapi("PayrollRunBasic");

export const payslipListSchema = z
  .array(
    z.object({
      runId: z.string(),
      year: z.number(),
      month: z.number(),
      currency: z.string(),
      status: z.string(),
      baseAmount: z.number(),
      overtimeMinutes: z.number(),
      overtimeAmount: z.number(),
      bonus: z.number(),
      deduction: z.number(),
      netAmount: z.number(),
    }),
  )
  .openapi("Payslips");

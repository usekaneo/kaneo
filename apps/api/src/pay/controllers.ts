import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { getAttendanceDays } from "../attendance/summary";
import { recordAudit } from "../audit/record-audit";
import { effectiveSchedule } from "../company/schedule";
import { getCompanySettings } from "../company/settings";
import { daysInMonth } from "../company/zoned-time";
import db from "../database";
import {
  employeeProfileTable,
  payrollItemTable,
  payrollRunTable,
  salaryTable,
  userTable,
  workspaceUserTable,
} from "../database/schema";
import { publishEvent } from "../events";
import { calculatePay, paidMinutesInMonth } from "./calculate";

const monthEnd = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth(year, month)).padStart(2, "0")}`;

// ----------------------------------------------------------------- salary

export async function salaryHistory(workspaceId: string, userId: string) {
  return db
    .select({
      id: salaryTable.id,
      amount: salaryTable.amount,
      type: salaryTable.type,
      effectiveFrom: salaryTable.effectiveFrom,
      note: salaryTable.note,
      createdAt: salaryTable.createdAt,
      createdByName: userTable.name,
    })
    .from(salaryTable)
    .leftJoin(userTable, eq(userTable.id, salaryTable.createdBy))
    .where(
      and(
        eq(salaryTable.workspaceId, workspaceId),
        eq(salaryTable.userId, userId),
      ),
    )
    .orderBy(desc(salaryTable.effectiveFrom), desc(salaryTable.createdAt));
}

// Salary history is append-only: a raise is a new row from its effective
// date, so what someone earned in January stays on record.
export async function addSalary(
  workspaceId: string,
  actorId: string,
  input: {
    userId: string;
    amount: number;
    type: "monthly" | "hourly";
    effectiveFrom: string;
    note?: string;
  },
) {
  const [member] = await db
    .select({ id: workspaceUserTable.id })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.userId, input.userId),
      ),
    );
  if (!member) throw new HTTPException(404, { message: "Person not found" });

  const [created] = await db
    .insert(salaryTable)
    .values({
      workspaceId,
      userId: input.userId,
      amount: input.amount,
      type: input.type,
      effectiveFrom: input.effectiveFrom,
      note: input.note ?? null,
      createdBy: actorId,
    })
    .returning();
  if (!created) throw new HTTPException(500, { message: "Failed to save" });

  await recordAudit({
    workspaceId,
    actorId,
    action: "salary.added",
    targetType: "user",
    targetId: input.userId,
    data: {
      amount: input.amount,
      type: input.type,
      effectiveFrom: input.effectiveFrom,
    },
  });
  return created;
}

/** The salary row in force on `day` for each person, if any. */
async function salariesOn(workspaceId: string, day: string) {
  const rows = await db
    .select()
    .from(salaryTable)
    .where(
      and(
        eq(salaryTable.workspaceId, workspaceId),
        lte(salaryTable.effectiveFrom, day),
      ),
    )
    .orderBy(desc(salaryTable.effectiveFrom), desc(salaryTable.createdAt));
  const current = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!current.has(row.userId)) current.set(row.userId, row);
  }
  return current;
}

export async function currentSalaries(workspaceId: string, today: string) {
  const [people, salaries] = await Promise.all([
    db
      .select({ userId: userTable.id, name: userTable.name })
      .from(workspaceUserTable)
      .innerJoin(userTable, eq(userTable.id, workspaceUserTable.userId))
      .where(eq(workspaceUserTable.workspaceId, workspaceId))
      .orderBy(userTable.name),
    salariesOn(workspaceId, today),
  ]);
  return people.map((p) => {
    const s = salaries.get(p.userId);
    return {
      userId: p.userId,
      name: p.name,
      amount: s?.amount ?? null,
      type: s?.type ?? null,
      effectiveFrom: s?.effectiveFrom ?? null,
    };
  });
}

// ---------------------------------------------------------------- payroll

type RunRow = typeof payrollRunTable.$inferSelect;

async function findRun(workspaceId: string, id: string) {
  const [run] = await db
    .select()
    .from(payrollRunTable)
    .where(
      and(
        eq(payrollRunTable.id, id),
        eq(payrollRunTable.workspaceId, workspaceId),
      ),
    );
  if (!run) throw new HTTPException(404, { message: "Payroll not found" });
  return run;
}

function assertDraft(run: RunRow) {
  if (run.status !== "draft") {
    throw new HTTPException(409, {
      message: "Only a draft payroll can be changed",
    });
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Draft edits hold the run's row lock, so an approval running at the same
// moment waits for them and then sees their result, never a half-edited draft.
async function lockDraft(tx: Tx, workspaceId: string, id: string) {
  const [run] = await tx
    .select()
    .from(payrollRunTable)
    .where(
      and(
        eq(payrollRunTable.id, id),
        eq(payrollRunTable.workspaceId, workspaceId),
      ),
    )
    .for("update");
  if (!run) throw new HTTPException(404, { message: "Payroll not found" });
  assertDraft(run);
  return run;
}

async function runTotals(runIds: string[]) {
  if (runIds.length === 0)
    return new Map<string, { count: number; net: number }>();
  const rows = await db
    .select({
      runId: payrollItemTable.runId,
      count: sql<number>`count(*)::int`,
      net: sql<number>`coalesce(sum(${payrollItemTable.netAmount}), 0)::bigint`,
    })
    .from(payrollItemTable)
    .where(inArray(payrollItemTable.runId, runIds))
    .groupBy(payrollItemTable.runId);
  return new Map(
    rows.map((r) => [r.runId, { count: r.count, net: Number(r.net) }]),
  );
}

export async function listRuns(workspaceId: string) {
  const runs = await db
    .select()
    .from(payrollRunTable)
    .where(eq(payrollRunTable.workspaceId, workspaceId))
    .orderBy(desc(payrollRunTable.year), desc(payrollRunTable.month));
  const totals = await runTotals(runs.map((r) => r.id));
  return runs.map((r) => ({
    ...presentRun(r),
    people: totals.get(r.id)?.count ?? 0,
    netTotal: totals.get(r.id)?.net ?? 0,
  }));
}

function presentRun(r: RunRow) {
  return {
    id: r.id,
    year: r.year,
    month: r.month,
    currency: r.currency,
    status: r.status,
    approvedAt: r.approvedAt,
    paidAt: r.paidAt,
    createdAt: r.createdAt,
  };
}

type KeptEdits = {
  bonus: number;
  deduction: number;
  note: string | null;
  // Set only when someone changed the overtime by hand.
  overtimeAmount: number | null;
};

/** Draft items for everyone with a salary in force at the end of the month. */
async function computeItems(
  workspaceId: string,
  year: number,
  month: number,
  keep: Map<string, KeptEdits>,
) {
  const company = await getCompanySettings(workspaceId);
  const last = monthEnd(year, month);
  const first = `${last.slice(0, 7)}-01`;
  const [salaries, profiles, people] = await Promise.all([
    salariesOn(workspaceId, last),
    db
      .select()
      .from(employeeProfileTable)
      .where(eq(employeeProfileTable.workspaceId, workspaceId)),
    db
      .select({ userId: userTable.id, name: userTable.name })
      .from(workspaceUserTable)
      .innerJoin(userTable, eq(userTable.id, workspaceUserTable.userId))
      .where(eq(workspaceUserTable.workspaceId, workspaceId)),
  ]);

  const items = [];
  for (const person of people) {
    const salary = salaries.get(person.userId);
    if (!salary) continue;
    const schedule = effectiveSchedule(
      company,
      profiles.find((p) => p.userId === person.userId),
    );
    const attendance = await getAttendanceDays(
      workspaceId,
      person.userId,
      first,
      last,
      new Date(),
      // Pay only for closed sessions; a forgotten clock-out is fixed first.
      { countOpen: false },
    );
    const kept = keep.get(person.userId);
    const bonus = kept?.bonus ?? 0;
    const deduction = kept?.deduction ?? 0;
    const salaryType = salary.type === "hourly" ? "hourly" : "monthly";
    const pay = calculatePay({
      salaryType,
      salaryAmount: salary.amount,
      workedMinutes: attendance.totals.workedMinutes,
      overtimeMinutes: attendance.totals.overtimeMinutes,
      scheduledPaidMinutes: paidMinutesInMonth(schedule, year, month),
      overtimeRatePercent: company.overtimeRatePercent,
      bonus,
      deduction,
    });
    const overtimeAmount = kept?.overtimeAmount ?? pay.overtimeAmount;
    items.push({
      userId: person.userId,
      employeeName: person.name,
      salaryType,
      salaryAmount: salary.amount,
      workedMinutes: attendance.totals.workedMinutes,
      overtimeMinutes: attendance.totals.overtimeMinutes,
      baseAmount: pay.baseAmount,
      overtimeRate: pay.overtimeRate,
      overtimeAutoAmount: pay.overtimeAmount,
      overtimeAmount,
      netAmount: pay.netAmount - pay.overtimeAmount + overtimeAmount,
      bonus,
      deduction,
      note: kept?.note ?? null,
    });
  }
  return { items, currency: company.currency };
}

export async function createRun(
  workspaceId: string,
  actorId: string,
  year: number,
  month: number,
) {
  const { items, currency } = await computeItems(
    workspaceId,
    year,
    month,
    new Map(),
  );
  const [run] = await db
    .insert(payrollRunTable)
    .values({ workspaceId, year, month, currency, createdBy: actorId })
    .onConflictDoNothing()
    .returning();
  if (!run) {
    throw new HTTPException(409, {
      message: "There is already a payroll for this month",
    });
  }
  if (items.length > 0) {
    await db
      .insert(payrollItemTable)
      .values(items.map((item) => ({ ...item, runId: run.id })));
  }
  await recordAudit({
    workspaceId,
    actorId,
    action: "payroll.created",
    targetType: "payroll_run",
    targetId: run.id,
    data: { year, month, people: items.length },
  });
  return getRun(workspaceId, run.id);
}

export async function getRun(workspaceId: string, id: string) {
  const run = await findRun(workspaceId, id);
  const items = await db
    .select()
    .from(payrollItemTable)
    .where(eq(payrollItemTable.runId, id))
    .orderBy(payrollItemTable.employeeName);
  return {
    ...presentRun(run),
    items: items.map((i) => ({
      id: i.id,
      userId: i.userId,
      employeeName: i.employeeName,
      salaryType: i.salaryType,
      salaryAmount: i.salaryAmount,
      workedMinutes: i.workedMinutes,
      overtimeMinutes: i.overtimeMinutes,
      baseAmount: i.baseAmount,
      overtimeAmount: i.overtimeAmount,
      overtimeRate: i.overtimeRate,
      overtimeAutoAmount: i.overtimeAutoAmount,
      bonus: i.bonus,
      deduction: i.deduction,
      netAmount: i.netAmount,
      note: i.note,
    })),
  };
}

/** Rebuild a draft from current salaries and attendance, keeping edits. */
export async function recalculateRun(
  workspaceId: string,
  actorId: string,
  id: string,
) {
  const run = await findRun(workspaceId, id);
  assertDraft(run);
  const existing = await db
    .select()
    .from(payrollItemTable)
    .where(eq(payrollItemTable.runId, id));
  const keep = new Map(
    existing
      .filter((i) => i.userId)
      .map((i) => [
        i.userId as string,
        {
          bonus: i.bonus,
          deduction: i.deduction,
          note: i.note,
          overtimeAmount:
            i.overtimeAmount !== i.overtimeAutoAmount ? i.overtimeAmount : null,
        },
      ]),
  );
  const { items } = await computeItems(workspaceId, run.year, run.month, keep);
  await db.transaction(async (tx) => {
    await lockDraft(tx, workspaceId, id);
    await tx.delete(payrollItemTable).where(eq(payrollItemTable.runId, id));
    if (items.length > 0) {
      await tx
        .insert(payrollItemTable)
        .values(items.map((item) => ({ ...item, runId: id })));
    }
  });
  await recordAudit({
    workspaceId,
    actorId,
    action: "payroll.recalculated",
    targetType: "payroll_run",
    targetId: id,
  });
  return getRun(workspaceId, id);
}

export async function updateItem(
  workspaceId: string,
  actorId: string,
  runId: string,
  itemId: string,
  input: {
    bonus: number;
    deduction: number;
    // A number sets the overtime by hand; null puts the automatic one back.
    overtimeAmount?: number | null;
    note?: string | null;
  },
) {
  const item = await db.transaction(async (tx) => {
    await lockDraft(tx, workspaceId, runId);
    const [item] = await tx
      .select()
      .from(payrollItemTable)
      .where(
        and(eq(payrollItemTable.id, itemId), eq(payrollItemTable.runId, runId)),
      );
    if (!item)
      throw new HTTPException(404, { message: "Payroll line not found" });

    const overtimeAmount =
      input.overtimeAmount === undefined
        ? item.overtimeAmount
        : (input.overtimeAmount ?? item.overtimeAutoAmount);
    const netAmount =
      item.baseAmount + overtimeAmount + input.bonus - input.deduction;
    await tx
      .update(payrollItemTable)
      .set({
        overtimeAmount,
        bonus: input.bonus,
        deduction: input.deduction,
        netAmount,
        ...(input.note !== undefined && { note: input.note }),
      })
      .where(eq(payrollItemTable.id, itemId));
    return { ...item, newOvertime: overtimeAmount };
  });

  await recordAudit({
    workspaceId,
    actorId,
    action: "payroll.line_updated",
    targetType: "payroll_run",
    targetId: runId,
    data: {
      employee: item.employeeName,
      from: {
        overtime: item.overtimeAmount,
        bonus: item.bonus,
        deduction: item.deduction,
      },
      to: {
        overtime: item.newOvertime,
        bonus: input.bonus,
        deduction: input.deduction,
      },
    },
  });
  return getRun(workspaceId, runId);
}

export async function changeRunStatus(
  workspaceId: string,
  actorId: string,
  id: string,
  next: "approved" | "paid",
) {
  const run = await findRun(workspaceId, id);
  const allowed = next === "approved" ? "draft" : "approved";
  const now = new Date();
  // Conditional on the current status, so two clicks can't both succeed.
  const [changed] = await db
    .update(payrollRunTable)
    .set(
      next === "approved"
        ? { status: next, approvedAt: now, approvedBy: actorId }
        : { status: next, paidAt: now },
    )
    .where(and(eq(payrollRunTable.id, id), eq(payrollRunTable.status, allowed)))
    .returning({ id: payrollRunTable.id });
  if (!changed) {
    throw new HTTPException(409, {
      message:
        next === "approved"
          ? "Only a draft payroll can be approved"
          : "Only an approved payroll can be marked paid",
    });
  }
  // Payslips become visible to employees at approval.
  if (next === "approved") {
    const people = await db
      .select({ userId: payrollItemTable.userId })
      .from(payrollItemTable)
      .where(eq(payrollItemTable.runId, id));
    await publishEvent("payslip.ready", {
      workspaceId,
      runId: id,
      year: run.year,
      month: run.month,
      userIds: people.flatMap((p) => (p.userId ? [p.userId] : [])),
    });
  }
  await recordAudit({
    workspaceId,
    actorId,
    action: `payroll.${next}`,
    targetType: "payroll_run",
    targetId: id,
    data: { year: run.year, month: run.month },
  });
  return getRun(workspaceId, id);
}

export async function deleteRun(
  workspaceId: string,
  actorId: string,
  id: string,
) {
  const run = await findRun(workspaceId, id);
  const [deleted] = await db
    .delete(payrollRunTable)
    .where(and(eq(payrollRunTable.id, id), eq(payrollRunTable.status, "draft")))
    .returning({ id: payrollRunTable.id });
  if (!deleted) {
    throw new HTTPException(409, {
      message: "Only a draft payroll can be changed",
    });
  }
  await recordAudit({
    workspaceId,
    actorId,
    action: "payroll.deleted",
    targetType: "payroll_run",
    targetId: id,
    data: { year: run.year, month: run.month },
  });
  return presentRun(run);
}

/** A person's own payslips: approved and paid months only. */
export async function payslips(workspaceId: string, userId: string) {
  const rows = await db
    .select({ item: payrollItemTable, run: payrollRunTable })
    .from(payrollItemTable)
    .innerJoin(payrollRunTable, eq(payrollRunTable.id, payrollItemTable.runId))
    .where(
      and(
        eq(payrollRunTable.workspaceId, workspaceId),
        eq(payrollItemTable.userId, userId),
        inArray(payrollRunTable.status, ["approved", "paid"]),
      ),
    )
    .orderBy(desc(payrollRunTable.year), desc(payrollRunTable.month));
  return rows.map(({ item, run }) => ({
    runId: run.id,
    year: run.year,
    month: run.month,
    currency: run.currency,
    status: run.status,
    baseAmount: item.baseAmount,
    overtimeMinutes: item.overtimeMinutes,
    overtimeAmount: item.overtimeAmount,
    bonus: item.bonus,
    deduction: item.deduction,
    netAmount: item.netAmount,
  }));
}

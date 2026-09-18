import { and, desc, eq, gte, inArray, lte, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { HTTPException } from "hono/http-exception";
import { recordAudit } from "../audit/record-audit";
import { effectiveSchedule, scheduledMinutes } from "../company/schedule";
import { getCompanySettings } from "../company/settings";
import { addDays } from "../company/zoned-time";
import db from "../database";
import {
  employeeProfileTable,
  expenseTable,
  leaveRequestTable,
  projectTable,
  storedFileTable,
  userTable,
} from "../database/schema";
import { publishEvent } from "../events";

// Leave types that use up the yearly allowance. Unpaid leave does not.
const COUNTED = ["annual", "sick"];

async function scheduleFor(workspaceId: string, userId: string) {
  const [company, [profile]] = await Promise.all([
    getCompanySettings(workspaceId),
    db
      .select()
      .from(employeeProfileTable)
      .where(
        and(
          eq(employeeProfileTable.workspaceId, workspaceId),
          eq(employeeProfileTable.userId, userId),
        ),
      ),
  ]);
  return { company, schedule: effectiveSchedule(company, profile) };
}

/** Working days in [start, end] on the person's own schedule. */
export async function workingDays(
  workspaceId: string,
  userId: string,
  start: string,
  end: string,
) {
  const { schedule } = await scheduleFor(workspaceId, userId);
  let days = 0;
  for (
    let day = start, walked = 0;
    day <= end && walked < 366;
    day = addDays(day, 1), walked++
  ) {
    if (scheduledMinutes(schedule, day) > 0) days += 1;
  }
  return days;
}

// ------------------------------------------------------------------ leave

const leaveColumns = {
  id: leaveRequestTable.id,
  userId: leaveRequestTable.userId,
  userName: userTable.name,
  type: leaveRequestTable.type,
  startDate: leaveRequestTable.startDate,
  endDate: leaveRequestTable.endDate,
  days: leaveRequestTable.days,
  reason: leaveRequestTable.reason,
  status: leaveRequestTable.status,
  decidedAt: leaveRequestTable.decidedAt,
  decisionNote: leaveRequestTable.decisionNote,
  createdAt: leaveRequestTable.createdAt,
};

const deciderTable = alias(userTable, "decider");

/**
 * Everyone's leave for approvers: filter by status, person, or the dates it
 * touches. Newest first; capped so a busy workspace stays quick.
 */
export async function listAllLeave(
  workspaceId: string,
  filters: {
    status?: string;
    userId?: string;
    from?: string;
    to?: string;
  },
) {
  return db
    .select({ ...leaveColumns, decidedByName: deciderTable.name })
    .from(leaveRequestTable)
    .innerJoin(userTable, eq(userTable.id, leaveRequestTable.userId))
    .leftJoin(deciderTable, eq(deciderTable.id, leaveRequestTable.decidedBy))
    .where(
      and(
        eq(leaveRequestTable.workspaceId, workspaceId),
        filters.status
          ? eq(leaveRequestTable.status, filters.status)
          : undefined,
        filters.userId
          ? eq(leaveRequestTable.userId, filters.userId)
          : undefined,
        filters.to ? lte(leaveRequestTable.startDate, filters.to) : undefined,
        filters.from ? gte(leaveRequestTable.endDate, filters.from) : undefined,
      ),
    )
    .orderBy(desc(leaveRequestTable.startDate))
    .limit(500);
}

export async function listLeave(workspaceId: string, userId: string) {
  return db
    .select(leaveColumns)
    .from(leaveRequestTable)
    .innerJoin(userTable, eq(userTable.id, leaveRequestTable.userId))
    .where(
      and(
        eq(leaveRequestTable.workspaceId, workspaceId),
        eq(leaveRequestTable.userId, userId),
      ),
    )
    .orderBy(desc(leaveRequestTable.startDate));
}

export async function leaveBalance(
  workspaceId: string,
  userId: string,
  year: number,
) {
  const company = await getCompanySettings(workspaceId);
  const rows = await db
    .select({
      status: leaveRequestTable.status,
      days: leaveRequestTable.days,
    })
    .from(leaveRequestTable)
    .where(
      and(
        eq(leaveRequestTable.workspaceId, workspaceId),
        eq(leaveRequestTable.userId, userId),
        inArray(leaveRequestTable.type, COUNTED),
        inArray(leaveRequestTable.status, ["approved", "pending"]),
        gte(leaveRequestTable.startDate, `${year}-01-01`),
        lte(leaveRequestTable.startDate, `${year}-12-31`),
      ),
    );
  const used = rows
    .filter((r) => r.status === "approved")
    .reduce((sum, r) => sum + r.days, 0);
  const pending = rows
    .filter((r) => r.status === "pending")
    .reduce((sum, r) => sum + r.days, 0);
  return {
    year,
    allowance: company.annualLeaveDays,
    used,
    pending,
    available: company.annualLeaveDays - used,
  };
}

export async function requestLeave(
  workspaceId: string,
  userId: string,
  input: {
    type: "annual" | "sick" | "unpaid";
    startDate: string;
    endDate: string;
    reason?: string;
  },
) {
  const days = await workingDays(
    workspaceId,
    userId,
    input.startDate,
    input.endDate,
  );
  if (days === 0) {
    throw new HTTPException(400, {
      message: "Those dates have no working days",
    });
  }

  const [overlap] = await db
    .select({ id: leaveRequestTable.id })
    .from(leaveRequestTable)
    .where(
      and(
        eq(leaveRequestTable.workspaceId, workspaceId),
        eq(leaveRequestTable.userId, userId),
        inArray(leaveRequestTable.status, ["pending", "approved"]),
        lte(leaveRequestTable.startDate, input.endDate),
        gte(leaveRequestTable.endDate, input.startDate),
      ),
    );
  if (overlap) {
    throw new HTTPException(409, {
      message: "You already have leave on some of those days",
    });
  }

  const [created] = await db
    .insert(leaveRequestTable)
    .values({
      workspaceId,
      userId,
      type: input.type,
      startDate: input.startDate,
      endDate: input.endDate,
      days,
      reason: input.reason ?? null,
    })
    .returning();
  if (!created) throw new HTTPException(500, { message: "Failed to save" });
  await publishEvent("leave.requested", {
    workspaceId,
    requestId: created.id,
    userId,
    type: created.type,
    startDate: created.startDate,
    endDate: created.endDate,
    days: created.days,
  });
  return created;
}

async function findLeave(workspaceId: string, id: string) {
  const [row] = await db
    .select()
    .from(leaveRequestTable)
    .where(
      and(
        eq(leaveRequestTable.id, id),
        eq(leaveRequestTable.workspaceId, workspaceId),
      ),
    );
  if (!row) throw new HTTPException(404, { message: "Request not found" });
  return row;
}

/**
 * People withdraw their own pending requests. An approver can also call off
 * approved leave that hasn't ended yet, when plans change.
 */
export async function cancelLeave(
  workspaceId: string,
  userId: string,
  id: string,
  canApprove = false,
  today?: string,
) {
  const row = await findLeave(workspaceId, id);
  const own = row.userId === userId;
  const from =
    own && row.status === "pending"
      ? "pending"
      : canApprove && row.status === "approved"
        ? "approved"
        : null;
  if (!own && !canApprove) {
    throw new HTTPException(403, {
      message: "You can only cancel your own request",
    });
  }
  if (!from) {
    throw new HTTPException(409, {
      message: canApprove
        ? "Only pending or approved leave can be cancelled"
        : "Only a pending request can be cancelled",
    });
  }
  if (from === "approved" && today && row.endDate < today) {
    throw new HTTPException(409, {
      message: "This leave is already over",
    });
  }
  // Every transition is conditional on the status it starts from, so a
  // cancel and an approval racing each other can't both win.
  const [changed] = await db
    .update(leaveRequestTable)
    .set({
      status: "cancelled",
      ...(from === "approved" && { decidedBy: userId, decidedAt: new Date() }),
    })
    .where(
      and(eq(leaveRequestTable.id, id), eq(leaveRequestTable.status, from)),
    )
    .returning({ id: leaveRequestTable.id });
  if (!changed) {
    throw new HTTPException(409, {
      message: "This request changed in the meantime",
    });
  }
  if (from === "approved") {
    await recordAudit({
      workspaceId,
      actorId: userId,
      action: "leave.cancelled",
      targetType: "user",
      targetId: row.userId,
      data: {
        requestId: id,
        type: row.type,
        startDate: row.startDate,
        endDate: row.endDate,
      },
    });
    if (!own) {
      await publishEvent("leave.decided", {
        workspaceId,
        requestId: id,
        userId: row.userId,
        actorId: userId,
        decision: "cancelled",
        type: row.type,
        startDate: row.startDate,
        endDate: row.endDate,
        note: null,
      });
    }
  }
  return { ...row, status: "cancelled" };
}

export async function decideLeave(
  workspaceId: string,
  actorId: string,
  id: string,
  decision: "approved" | "rejected",
  note?: string,
) {
  const row = await findLeave(workspaceId, id);
  if (row.userId === actorId) {
    throw new HTTPException(403, {
      message: "Someone else has to decide your own request",
    });
  }
  if (row.status !== "pending") {
    throw new HTTPException(409, {
      message: "This request was already decided",
    });
  }
  const [updated] = await db
    .update(leaveRequestTable)
    .set({
      status: decision,
      decidedBy: actorId,
      decidedAt: new Date(),
      decisionNote: note ?? null,
    })
    .where(
      and(
        eq(leaveRequestTable.id, id),
        eq(leaveRequestTable.status, "pending"),
      ),
    )
    .returning();
  if (!updated) {
    throw new HTTPException(409, {
      message: "This request was already decided",
    });
  }
  await recordAudit({
    workspaceId,
    actorId,
    action: `leave.${decision}`,
    targetType: "user",
    targetId: row.userId,
    data: {
      requestId: id,
      type: row.type,
      startDate: row.startDate,
      endDate: row.endDate,
      days: row.days,
    },
  });
  await publishEvent("leave.decided", {
    workspaceId,
    requestId: id,
    userId: row.userId,
    actorId,
    decision,
    type: row.type,
    startDate: row.startDate,
    endDate: row.endDate,
    note: note ?? null,
  });
  return updated;
}

// --------------------------------------------------------------- expenses

const expenseColumns = {
  id: expenseTable.id,
  userId: expenseTable.userId,
  userName: userTable.name,
  amount: expenseTable.amount,
  currency: expenseTable.currency,
  category: expenseTable.category,
  description: expenseTable.description,
  spentOn: expenseTable.spentOn,
  projectId: expenseTable.projectId,
  projectName: projectTable.name,
  receiptFileId: expenseTable.receiptFileId,
  receiptName: storedFileTable.filename,
  status: expenseTable.status,
  decidedAt: expenseTable.decidedAt,
  paidAt: expenseTable.paidAt,
  createdAt: expenseTable.createdAt,
};

function selectExpenses() {
  return db
    .select(expenseColumns)
    .from(expenseTable)
    .innerJoin(userTable, eq(userTable.id, expenseTable.userId))
    .leftJoin(projectTable, eq(projectTable.id, expenseTable.projectId))
    .leftJoin(
      storedFileTable,
      eq(storedFileTable.id, expenseTable.receiptFileId),
    );
}

export async function listExpenses(workspaceId: string, userId: string) {
  return selectExpenses()
    .where(
      and(
        eq(expenseTable.workspaceId, workspaceId),
        eq(expenseTable.userId, userId),
      ),
    )
    .orderBy(desc(expenseTable.spentOn), desc(expenseTable.createdAt));
}

export async function submitExpense(
  workspaceId: string,
  userId: string,
  input: {
    amount: number;
    category: string;
    description?: string;
    spentOn: string;
    projectId?: string;
    receiptFileId?: string;
  },
) {
  const company = await getCompanySettings(workspaceId);

  if (input.projectId) {
    const [project] = await db
      .select({ id: projectTable.id })
      .from(projectTable)
      .where(
        and(
          eq(projectTable.id, input.projectId),
          eq(projectTable.workspaceId, workspaceId),
        ),
      );
    if (!project) throw new HTTPException(400, { message: "Unknown project" });
  }
  if (input.receiptFileId) {
    // A receipt can only be attached by the person who uploaded it.
    const [file] = await db
      .select({ id: storedFileTable.id })
      .from(storedFileTable)
      .where(
        and(
          eq(storedFileTable.id, input.receiptFileId),
          eq(storedFileTable.workspaceId, workspaceId),
          eq(storedFileTable.uploadedBy, userId),
        ),
      );
    if (!file) throw new HTTPException(400, { message: "Unknown receipt" });
  }

  const [created] = await db
    .insert(expenseTable)
    .values({
      workspaceId,
      userId,
      amount: input.amount,
      currency: company.currency,
      category: input.category,
      description: input.description ?? null,
      spentOn: input.spentOn,
      projectId: input.projectId ?? null,
      receiptFileId: input.receiptFileId ?? null,
    })
    .returning({ id: expenseTable.id });
  if (!created) throw new HTTPException(500, { message: "Failed to save" });
  const [row] = await selectExpenses().where(eq(expenseTable.id, created.id));
  return row;
}

async function findExpense(workspaceId: string, id: string) {
  const [row] = await db
    .select()
    .from(expenseTable)
    .where(
      and(eq(expenseTable.id, id), eq(expenseTable.workspaceId, workspaceId)),
    );
  if (!row) throw new HTTPException(404, { message: "Expense not found" });
  return row;
}

async function presentExpense(id: string) {
  const [row] = await selectExpenses().where(eq(expenseTable.id, id));
  if (!row) throw new HTTPException(404, { message: "Expense not found" });
  return row;
}

export async function cancelExpense(
  workspaceId: string,
  userId: string,
  id: string,
) {
  const row = await findExpense(workspaceId, id);
  if (row.userId !== userId) {
    throw new HTTPException(403, {
      message: "You can only cancel your own expense",
    });
  }
  if (row.status !== "pending") {
    throw new HTTPException(409, {
      message: "Only a pending expense can be cancelled",
    });
  }
  const [changed] = await db
    .delete(expenseTable)
    .where(and(eq(expenseTable.id, id), eq(expenseTable.status, "pending")))
    .returning({ id: expenseTable.id });
  if (!changed) {
    throw new HTTPException(409, {
      message: "Only a pending expense can be cancelled",
    });
  }
  return { id };
}

export async function decideExpense(
  workspaceId: string,
  actorId: string,
  id: string,
  decision: "approved" | "rejected",
) {
  const row = await findExpense(workspaceId, id);
  if (row.userId === actorId) {
    throw new HTTPException(403, {
      message: "Someone else has to decide your own expense",
    });
  }
  if (row.status !== "pending") {
    throw new HTTPException(409, {
      message: "This expense was already decided",
    });
  }
  const [changed] = await db
    .update(expenseTable)
    .set({ status: decision, decidedBy: actorId, decidedAt: new Date() })
    .where(and(eq(expenseTable.id, id), eq(expenseTable.status, "pending")))
    .returning({ id: expenseTable.id });
  if (!changed) {
    throw new HTTPException(409, {
      message: "This expense was already decided",
    });
  }
  await recordAudit({
    workspaceId,
    actorId,
    action: `expense.${decision}`,
    targetType: "user",
    targetId: row.userId,
    data: { expenseId: id, amount: row.amount, currency: row.currency },
  });
  return presentExpense(id);
}

export async function markExpensePaid(
  workspaceId: string,
  actorId: string,
  id: string,
) {
  const row = await findExpense(workspaceId, id);
  if (row.status !== "approved") {
    throw new HTTPException(409, {
      message: "Only an approved expense can be marked paid",
    });
  }
  const [changed] = await db
    .update(expenseTable)
    .set({ status: "paid", paidAt: new Date() })
    .where(and(eq(expenseTable.id, id), eq(expenseTable.status, "approved")))
    .returning({ id: expenseTable.id });
  if (!changed) {
    throw new HTTPException(409, {
      message: "Only an approved expense can be marked paid",
    });
  }
  await recordAudit({
    workspaceId,
    actorId,
    action: "expense.paid",
    targetType: "user",
    targetId: row.userId,
    data: { expenseId: id, amount: row.amount, currency: row.currency },
  });
  return presentExpense(id);
}

/** Everything waiting on an approver, plus approved expenses not yet paid. */
export async function openRequests(workspaceId: string) {
  const [leave, expenses] = await Promise.all([
    db
      .select(leaveColumns)
      .from(leaveRequestTable)
      .innerJoin(userTable, eq(userTable.id, leaveRequestTable.userId))
      .where(
        and(
          eq(leaveRequestTable.workspaceId, workspaceId),
          eq(leaveRequestTable.status, "pending"),
        ),
      )
      .orderBy(leaveRequestTable.startDate),
    selectExpenses()
      .where(
        and(
          eq(expenseTable.workspaceId, workspaceId),
          or(
            eq(expenseTable.status, "pending"),
            eq(expenseTable.status, "approved"),
          ),
        ),
      )
      .orderBy(expenseTable.createdAt),
  ]);
  return { leave, expenses };
}

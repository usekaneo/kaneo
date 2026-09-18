import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { recordAudit } from "../../audit/record-audit";
import db from "../../database";
import {
  departmentTable,
  employeeProfileTable,
  workspaceUserTable,
} from "../../database/schema";
import getPerson from "./get-person";

type UpdatePersonInput = {
  title?: string | null;
  departmentId?: string | null;
  joinDate?: string | null;
  status?: "active" | "on_leave" | "inactive";
  workDays?: number[] | null;
  workStart?: string | null;
  workEnd?: string | null;
  breakMinutes?: number | null;
};

async function updatePerson(
  workspaceId: string,
  userId: string,
  actorId: string,
  input: UpdatePersonInput,
) {
  const [member] = await db
    .select({ id: workspaceUserTable.id })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.userId, userId),
      ),
    );
  if (!member) {
    throw new HTTPException(404, { message: "Person not found" });
  }

  if (input.departmentId) {
    const [department] = await db
      .select({ id: departmentTable.id })
      .from(departmentTable)
      .where(
        and(
          eq(departmentTable.id, input.departmentId),
          eq(departmentTable.workspaceId, workspaceId),
        ),
      );
    if (!department) {
      throw new HTTPException(400, { message: "Unknown department" });
    }
  }

  const before = await getPerson(workspaceId, userId);

  const values = {
    ...(input.title !== undefined && { title: input.title || null }),
    ...(input.departmentId !== undefined && {
      departmentId: input.departmentId,
    }),
    ...(input.joinDate !== undefined && { joinDate: input.joinDate }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.workDays !== undefined && {
      workDays: input.workDays
        ? [...new Set(input.workDays)].sort().join(",")
        : null,
    }),
    ...(input.workStart !== undefined && { workStart: input.workStart }),
    ...(input.workEnd !== undefined && { workEnd: input.workEnd }),
    ...(input.breakMinutes !== undefined && {
      breakMinutes: input.breakMinutes,
    }),
  };

  if (Object.keys(values).length > 0) {
    await db
      .insert(employeeProfileTable)
      .values({ workspaceId, userId, ...values })
      .onConflictDoUpdate({
        target: [employeeProfileTable.workspaceId, employeeProfileTable.userId],
        set: values,
      });
  }

  const after = await getPerson(workspaceId, userId);

  const compared = {
    title: [before.title, after.title],
    department: [before.departmentName, after.departmentName],
    joinDate: [before.joinDate, after.joinDate],
    status: [before.status, after.status],
    schedule: [before.overrides, after.overrides],
  } as const;
  const changed = Object.fromEntries(
    Object.entries(compared)
      .filter(([, [from, to]]) => JSON.stringify(from) !== JSON.stringify(to))
      .map(([key, [from, to]]) => [key, { from, to }]),
  );
  if (Object.keys(changed).length > 0) {
    await recordAudit({
      workspaceId,
      actorId,
      action: "person.updated",
      targetType: "user",
      targetId: userId,
      data: changed,
    });
  }

  return after;
}

export default updatePerson;

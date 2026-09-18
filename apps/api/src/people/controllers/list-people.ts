import { and, eq } from "drizzle-orm";
import { clockedInUserIds, onlineUserIds } from "../../company/presence";
import db from "../../database";
import {
  departmentTable,
  employeeProfileTable,
  userTable,
  workspaceUserTable,
} from "../../database/schema";

// Pass `userId` for one person; the workspace filter is always applied here
// because a second .where() on the builder would replace it.
export function selectPeople(workspaceId: string, userId?: string) {
  return db
    .select({
      userId: workspaceUserTable.userId,
      name: userTable.name,
      email: userTable.email,
      image: userTable.image,
      role: workspaceUserTable.role,
      title: employeeProfileTable.title,
      departmentId: employeeProfileTable.departmentId,
      departmentName: departmentTable.name,
      joinDate: employeeProfileTable.joinDate,
      status: employeeProfileTable.status,
      workDays: employeeProfileTable.workDays,
      workStart: employeeProfileTable.workStart,
      workEnd: employeeProfileTable.workEnd,
      breakMinutes: employeeProfileTable.breakMinutes,
    })
    .from(workspaceUserTable)
    .innerJoin(userTable, eq(userTable.id, workspaceUserTable.userId))
    .leftJoin(
      employeeProfileTable,
      and(
        eq(employeeProfileTable.workspaceId, workspaceUserTable.workspaceId),
        eq(employeeProfileTable.userId, workspaceUserTable.userId),
      ),
    )
    .leftJoin(
      departmentTable,
      eq(departmentTable.id, employeeProfileTable.departmentId),
    )
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        userId ? eq(workspaceUserTable.userId, userId) : undefined,
      ),
    );
}

type PersonRow = Awaited<ReturnType<typeof selectPeople>>[number];

export function toPerson(
  row: PersonRow,
  clockedIn: Set<string>,
  online: Set<string>,
) {
  return {
    userId: row.userId,
    name: row.name,
    email: row.email,
    image: row.image,
    role: row.role,
    title: row.title,
    departmentId: row.departmentId,
    departmentName: row.departmentName,
    joinDate: row.joinDate,
    status: row.status ?? "active",
    clockedIn: clockedIn.has(row.userId),
    online: online.has(row.userId),
  };
}

// The directory every member can see: who is here and what they do. Private
// details (schedule, pay, activity) are served elsewhere behind permissions.
async function listPeople(workspaceId: string) {
  const [rows, clockedIn, online] = await Promise.all([
    selectPeople(workspaceId).orderBy(userTable.name),
    clockedInUserIds(workspaceId),
    onlineUserIds(workspaceId),
  ]);
  return rows.map((row) => toPerson(row, clockedIn, online));
}

export default listPeople;

import { and, count, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { recordAudit } from "../../audit/record-audit";
import db from "../../database";
import { departmentTable, employeeProfileTable } from "../../database/schema";

export async function listDepartments(workspaceId: string) {
  return db
    .select({
      id: departmentTable.id,
      name: departmentTable.name,
      memberCount: count(employeeProfileTable.id),
    })
    .from(departmentTable)
    .leftJoin(
      employeeProfileTable,
      eq(employeeProfileTable.departmentId, departmentTable.id),
    )
    .where(eq(departmentTable.workspaceId, workspaceId))
    .groupBy(departmentTable.id)
    .orderBy(departmentTable.name);
}

export async function createDepartment(
  workspaceId: string,
  actorId: string,
  name: string,
) {
  const [created] = await db
    .insert(departmentTable)
    .values({ workspaceId, name })
    .onConflictDoNothing()
    .returning();

  if (!created) {
    throw new HTTPException(409, {
      message: "A department with this name already exists",
    });
  }

  await recordAudit({
    workspaceId,
    actorId,
    action: "department.created",
    targetType: "department",
    targetId: created.id,
    data: { name },
  });

  return { id: created.id, name: created.name, memberCount: 0 };
}

export async function deleteDepartment(
  workspaceId: string,
  actorId: string,
  id: string,
) {
  const [deleted] = await db
    .delete(departmentTable)
    .where(
      and(
        eq(departmentTable.id, id),
        eq(departmentTable.workspaceId, workspaceId),
      ),
    )
    .returning();

  if (!deleted) {
    throw new HTTPException(404, { message: "Department not found" });
  }

  await recordAudit({
    workspaceId,
    actorId,
    action: "department.deleted",
    targetType: "department",
    targetId: id,
    data: { name: deleted.name },
  });

  return { id: deleted.id, name: deleted.name, memberCount: 0 };
}

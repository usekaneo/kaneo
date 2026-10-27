import { asc } from "drizzle-orm";
import db from "../../database";
import { instanceRoleTable } from "../../database/schema";
import {
  instanceRoleColumns,
  toInstanceRole,
} from "../roles/find-instance-role";

/** Custom instance roles by name. Built-in admin and user are not stored. */
async function listInstanceRoles() {
  const rows = await db
    .select(instanceRoleColumns)
    .from(instanceRoleTable)
    .orderBy(asc(instanceRoleTable.name));
  return { roles: rows.map(toInstanceRole) };
}

export default listInstanceRoles;

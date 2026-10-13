import { type AnyColumn, sql } from "drizzle-orm";

export function hasInstanceAdminRole(role: unknown) {
  return typeof role === "string" && role.split(",").includes("admin");
}

export function instanceAdminRoleSql(column: AnyColumn) {
  return sql`'admin' = ANY(string_to_array(${column}, ','))`;
}

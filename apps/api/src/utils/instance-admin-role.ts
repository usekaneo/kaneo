import { type AnyColumn, sql } from "drizzle-orm";

export function hasInstanceAdminRole(role: unknown) {
  return (
    typeof role === "string" &&
    role
      .split(",")
      .map((entry) => entry.trim())
      .includes("admin")
  );
}

export function instanceAdminRoleSql(column: AnyColumn) {
  return sql`EXISTS (SELECT 1 FROM unnest(string_to_array(${column}, ',')) AS entry WHERE btrim(entry) = 'admin')`;
}

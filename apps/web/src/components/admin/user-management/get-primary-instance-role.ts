import { parseInstanceRoles } from "@kaneo/permissions";

/**
 * The one role the directory shows and edits: admin when present, else the
 * first custom role, else user. Admins assign a single role.
 */
export function getPrimaryInstanceRole(role: string | null | undefined) {
  const names = parseInstanceRoles(role);
  if (names.includes("admin")) return "admin";
  return names.find((name) => name !== "user") ?? "user";
}

import type { ImportedPerson } from "../types.js";
import type { JiraUser } from "./api-types.js";

export function toPerson(
  user: JiraUser | null | undefined,
): ImportedPerson | undefined {
  const name = user?.displayName?.trim();
  const email = user?.emailAddress?.trim();
  if (!name && !email) return undefined;
  return { ...(name ? { name } : {}), ...(email ? { email } : {}) };
}

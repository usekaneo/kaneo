import type { ImportedPerson } from "../types.js";
import type { LinearUser } from "./client.js";

export function toPerson(
  user: LinearUser | null | undefined,
): ImportedPerson | undefined {
  const name = user?.name?.trim();
  const email = user?.email?.trim();
  if (!name && !email) return undefined;
  return { ...(name ? { name } : {}), ...(email ? { email } : {}) };
}

import { and, asc, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { contactOptionTable } from "../../database/schema";
import type { ContactOptionKind } from "./defaults";
import { ensureDefaultOptions } from "./ensure-default-options";
import { normalizeLabel } from "./normalize-labels";

const KIND_NAME: Record<ContactOptionKind, string> = {
  type: "type",
  region: "region",
};
const LISTED_CHOICES = 50;

async function validChoices(workspaceId: string, kind: ContactOptionKind) {
  const rows = await db
    .select({ label: contactOptionTable.label })
    .from(contactOptionTable)
    .where(
      and(
        eq(contactOptionTable.workspaceId, workspaceId),
        eq(contactOptionTable.kind, kind),
      ),
    )
    .orderBy(asc(contactOptionTable.position))
    .limit(LISTED_CHOICES + 1);
  const listed = rows.slice(0, LISTED_CHOICES).map((row) => row.label);
  return rows.length > LISTED_CHOICES
    ? `${listed.join(", ")}, …`
    : listed.join(", ");
}

// Accepts an option's key or, ignoring case, its label, and returns the option
// of this workspace. Throws 400 naming the valid choices otherwise.
export async function resolveContactOption(
  workspaceId: string,
  kind: ContactOptionKind,
  input: string,
) {
  await ensureDefaultOptions(workspaceId);
  const scope = and(
    eq(contactOptionTable.workspaceId, workspaceId),
    eq(contactOptionTable.kind, kind),
  );
  const columns = {
    key: contactOptionTable.key,
    label: contactOptionTable.label,
  };
  const value = input.trim();

  const [byKey] = await db
    .select(columns)
    .from(contactOptionTable)
    .where(and(scope, eq(contactOptionTable.key, value)))
    .limit(1);
  const [byLabel] = await db
    .select(columns)
    .from(contactOptionTable)
    .where(
      and(
        scope,
        sql`lower(${contactOptionTable.label}) = lower(${normalizeLabel(value)})`,
      ),
    )
    .limit(1);

  // A key and another option's name can spell the same word (a renamed
  // default, a newly added "Male"). Keys are what the app sends, so a key wins
  // unless the input is exactly another option's name, spelled the same way.
  if (byKey && byLabel && byKey.key !== byLabel.key) {
    return byLabel.label === value ? byLabel : byKey;
  }
  if (byKey ?? byLabel) return (byKey ?? byLabel)!;

  throw new HTTPException(400, {
    message: `Unknown ${KIND_NAME[kind]} "${value}". Valid choices: ${await validChoices(workspaceId, kind)}`,
  });
}

// null and undefined pass through: "not set" and "leave unchanged".
export async function resolveOptionKey(
  workspaceId: string,
  kind: ContactOptionKind,
  input: string | null | undefined,
) {
  if (input === null || input === undefined) return input;
  return (await resolveContactOption(workspaceId, kind, input)).key;
}

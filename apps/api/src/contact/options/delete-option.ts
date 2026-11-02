import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { contactOptionTable, contactTable } from "../../database/schema";
import { columnForKind } from "./column-for-kind";
import type { ContactOptionKind } from "./defaults";
import { ensureDefaultOptions } from "./ensure-default-options";
import { lockKind } from "./lock-kind";

// Contacts using the option become "not set". The last option of a list
// cannot go: it would leave nothing to choose, and an empty list is what the
// lazy seeding treats as "not set up yet".
async function deleteOption(
  workspaceId: string,
  kind: ContactOptionKind,
  key: string,
) {
  await ensureDefaultOptions(workspaceId);
  return db.transaction(async (tx) => {
    const options = await lockKind(tx, workspaceId, kind);
    const target = options.find((candidate) => candidate.key === key);
    if (!target) throw new HTTPException(404, { message: "Option not found" });
    if (options.length <= 1) {
      throw new HTTPException(400, {
        message: `Cannot delete the last ${kind}; add another one first`,
      });
    }
    const cleared = await tx
      .update(contactTable)
      .set({ [kind === "type" ? "type" : "region"]: null })
      .where(
        and(
          eq(contactTable.workspaceId, workspaceId),
          eq(columnForKind(kind), key),
        ),
      )
      .returning({ id: contactTable.id });
    await tx
      .delete(contactOptionTable)
      .where(eq(contactOptionTable.id, target.id));
    return { key, affectedContacts: cleared.length };
  });
}

export default deleteOption;

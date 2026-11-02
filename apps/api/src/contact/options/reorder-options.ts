import { sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import type { ContactOptionKind } from "./defaults";
import { ensureDefaultOptions } from "./ensure-default-options";
import { lockKind } from "./lock-kind";
import listOptions from "./list-options";

// Listed keys come first in the given order; options the caller did not list
// (for example added by someone else meanwhile) keep their order after them.
async function reorderOptions(
  workspaceId: string,
  kind: ContactOptionKind,
  keys: string[],
) {
  await ensureDefaultOptions(workspaceId);
  await db.transaction(async (tx) => {
    const options = await lockKind(tx, workspaceId, kind);
    const known = new Set(options.map((option) => option.key));
    if (new Set(keys).size !== keys.length || keys.some((k) => !known.has(k))) {
      throw new HTTPException(400, {
        message: "keys must be distinct keys of existing options",
      });
    }
    const listed = new Set(keys);
    const order = [
      ...keys,
      ...options.map((o) => o.key).filter((key) => !listed.has(key)),
    ];
    await tx.execute(sql`
      update contact_option as o
      set position = v.position, updated_at = now() at time zone 'utc'
      from (values ${sql.join(
        order.map((key, index) => sql`(${key}::text, ${index}::int)`),
        sql`, `,
      )}) as v(key, position)
      where o.workspace_id = ${workspaceId}
        and o.kind = ${kind}
        and o.key = v.key
        and o.position is distinct from v.position
    `);
  });
  return listOptions(workspaceId);
}

export default reorderOptions;

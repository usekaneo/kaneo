import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import db from "../../database";
import { CONTACT_OPTION_KINDS, DEFAULT_CONTACT_OPTIONS } from "./defaults";

export type Executor = Pick<typeof db, "execute" | "select" | "update">;

// Seeds the defaults for each kind that has no options yet. Safe to call on
// every request and from concurrent first requests: a kind that already has
// options is skipped, and ON CONFLICT covers two seeders racing. Deleting the
// last option of a kind is refused, so "no options" only ever means "unseeded".
export async function ensureDefaultOptions(
  workspaceId: string,
  executor: Executor = db,
) {
  const rows = CONTACT_OPTION_KINDS.flatMap((kind) =>
    DEFAULT_CONTACT_OPTIONS[kind].map(
      (option, position) =>
        sql`(${createId()}, ${workspaceId}, ${kind}, ${option.key}, ${option.label}, ${position}::int)`,
    ),
  );
  await executor.execute(sql`
    insert into contact_option (id, workspace_id, kind, key, label, position)
    select v.id, v.workspace_id, v.kind, v.key, v.label, v.position
    from (values ${sql.join(rows, sql`, `)}) as v(id, workspace_id, kind, key, label, position)
    where not exists (
      select 1 from contact_option o
      where o.workspace_id = v.workspace_id and o.kind = v.kind
    )
    on conflict do nothing
  `);
}

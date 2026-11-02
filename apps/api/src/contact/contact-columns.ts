import { sql } from "drizzle-orm";
import { contactTable } from "../database/schema";

// The outer columns are written out in full: drizzle drops the table name from
// columns inside sql`` on single-table queries, which would then bind to `o`.
const labelOf = (kind: "type" | "region") =>
  sql<string | null>`(
    select o.label from contact_option o
    where o.workspace_id = "contact"."workspace_id"
      and o.kind = ${kind}
      and o.key = ${sql.raw(`"contact"."${kind}"`)}
  )`;

// The columns of a contact response. The labels come from the workspace's
// options; they are null when the contact has none or its option is gone.
export const contactColumns = {
  id: contactTable.id,
  workspaceId: contactTable.workspaceId,
  name: contactTable.name,
  phone: contactTable.phone,
  email: contactTable.email,
  type: contactTable.type,
  typeLabel: labelOf("type"),
  region: contactTable.region,
  regionLabel: labelOf("region"),
  notes: contactTable.notes,
  createdAt: contactTable.createdAt,
  updatedAt: contactTable.updatedAt,
};

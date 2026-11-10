import { sql } from "drizzle-orm";
import {
  pgSchema,
  pgPolicy,
  text,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { workspaceTable } from "../schema";

export const quillsSchema = pgSchema("quills");

export function workspaceColumn() {
  return text("workspace_id")
    .notNull()
    .default(sql`nullif(current_setting('quills.workspace_id', true), '')`)
    .references(() => workspaceTable.id, { onDelete: "cascade" });
}

export function workspacePolicy(column: AnyPgColumn) {
  const matches = sql`${column} = nullif(current_setting('quills.workspace_id', true), '')`;
  return pgPolicy("workspace_isolation", {
    using: matches,
    withCheck: matches,
  });
}

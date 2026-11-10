import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { foreignKey, primaryKey } from "drizzle-orm/pg-core";
/**
 * Macros — reusable agent replies with variables and bundled actions
 * (support platform §4.6). A macro is a canned reply upgraded two ways: the
 * body supports {firstName}-style variables rendered against the live
 * conversation, and it can carry a list of actions (assign, tag, set priority,
 * snooze, close, ...) applied when an agent uses it. Supersedes the old
 * settings-JSON `cannedReplies`; 0146 copies `messenger.cannedReplies`, and
 * 0277 copies leftover 0.13.x `chat.cannedReplies` after rewriting that key.
 *
 * `created_by_principal_id` is a team actor (macros are authored by staff), so
 * it is exempt from the anonymous-to-identified principal re-point.
 */
import { text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { typeIdWithDefault, typeIdColumnNullable } from "@kaneo/ids/drizzle";
import { principal } from "./auth";

/** Where a macro is offered: the support inbox, the feedback surfaces, or both. */
export type MacroScope = "support" | "feedback" | "both";

/** Triage priority a macro can set (mirrors the conversation priority union). */
export type MacroPriority = "none" | "low" | "medium" | "high" | "urgent";

/** Snooze targets a macro can defer a conversation to. */
export type MacroSnoozePreset = "until_reply" | "tomorrow" | "next_week";

/** The JSON value shapes a set_attribute action can carry, by field type:
 *  text/date/select store strings (select stores the option id), number a
 *  number, checkbox a boolean, multi_select an array of option ids; null
 *  unsets. */
export type MacroAttributeValue = string | number | boolean | string[] | null;

/**
 * A bundled action a macro runs against the conversation it is used in. Stored
 * as a jsonb array; the discriminant is `type`. `set_attribute` carries the
 * typed JSON value the definition-validated writer applies — see
 * applyMacroActions.
 */
export type MacroAction =
  | { type: "assign_agent"; principalId: string }
  | { type: "assign_team"; teamId: string }
  | { type: "add_tag"; tagId: string }
  | { type: "set_priority"; priority: MacroPriority }
  | { type: "snooze"; preset: MacroSnoozePreset }
  | { type: "close" }
  | { type: "set_attribute"; key: string; value: MacroAttributeValue };

export const macros = quillsSchema
  .table(
    "macros",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("macro")("id").notNull(),
      // Admin-facing label shown in the manager list and the composer picker.
      name: text("name").notNull(),
      // Reply text; supports {firstName} {lastName} {email} {conversationTitle}.
      body: text("body").notNull(),
      // support | feedback | both — which surfaces offer this macro.
      scope: text("scope").$type<MacroScope>().notNull().default("support"),
      // Ordered bundled actions run when the macro is used.
      actions: jsonb("actions").$type<MacroAction[]>().notNull().default([]),
      // Authoring team member; nulled on their deletion (keep the macro).
      createdByPrincipalId: typeIdColumnNullable("principal")(
        "created_by_principal_id",
      ),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
      // Soft delete — a used-then-removed macro stays for audit/attribution.
      deletedAt: timestamp("deleted_at", { withTimezone: true }),
    },
    (table) => [
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.createdByPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

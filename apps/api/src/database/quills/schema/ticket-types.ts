import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey, unique } from "drizzle-orm/pg-core";
/**
 * Ticket types — the workspace's registry of user-defined ticket kinds
 * (convergence Phase 4, scratchpad/convergence-design.md). A type is a label +
 * icon + color + typed field set WITHIN one of the three fixed categories
 * (`customer` / `back_office` / `tracker`). The category stays the BEHAVIOR
 * axis — cascade rules, portal visibility, SLA exclusion, the
 * one-customer-ticket link rule, and the denormalized
 * `ticket_conversations.ticket_type` all keep keying off `tickets.type`; a
 * custom type only adds the name/look and the intake `fields[]` on top.
 *
 * `tickets.type` (the category) is DERIVED from the chosen type at write time
 * and asserted consistent, so every existing index and rule is untouched.
 * `tickets.ticket_type_id` is nullable: legacy rows predate the registry and
 * archive-not-delete keeps in-use types alive, so the FK is `set null` only
 * for the hard-delete escape hatch — the service archives instead.
 *
 * Exactly one type per category is the category DEFAULT (the partial unique
 * index below): it is preselected in the create dialog and used by the 0215
 * backfill. `fields` reuses the ticketFormFieldSchema wire shape (the same
 * shape the per-category intake forms used); the zod schema in
 * `apps/web/src/lib/shared/tickets.ts` stays the validation source of truth —
 * this local interface only mirrors the wire shape for column typing (the db
 * package cannot import from apps/web).
 *
 * Soft-deleted (`deleted_at`): an in-use type archives and stays on ticket
 * history forever; it is never hard-deleted. Scoped to the workspace by the
 * database connection (database-per-workspace); no workspace column.
 */
import {
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { typeIdWithDefault } from "@kaneo/ids/drizzle";
import { TICKET_TYPES } from "../types";

/**
 * Wire shape of one entry in `ticket_types.fields` — mirrors
 * `ticketFormFieldSchema` (apps/web/src/lib/shared/tickets.ts), which remains
 * the validation source of truth on both the client editor and the server
 * write path. Duplicated here only so the column is typed; keep in lockstep.
 */
export interface TicketTypeField {
  key: string;
  label: string;
  type: "text" | "long_text" | "number" | "select" | "date" | "checkbox";
  required: boolean;
  visibleToCustomer: boolean;
  order: number;
  options?: string[];
}

export const ticketTypes = quillsSchema
  .table(
    "ticket_types",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("ticket_type")("id").notNull(),
      name: text("name").notNull(),
      slug: text("slug").notNull(),
      // The behavior axis this type lives within. LOCKED once tickets reference
      // the type (recategorizing would silently change behavior on history) —
      // enforced by the service, not the schema.
      category: text("category", { enum: TICKET_TYPES }).notNull(),
      icon: text("icon"),
      color: text("color").notNull().default("#6b7280"),
      // The type's typed field set (ticketFormFieldSchema shape). Answers land in
      // tickets.custom_attributes keyed by field key; orphaned keys stay stored
      // when a field leaves the schema (the retype rule — never rewritten).
      fields: jsonb("fields").$type<TicketTypeField[]>().notNull().default([]),
      isDefault: boolean("is_default").notNull().default(false),
      position: integer("position").notNull().default(0),
      // Whether the type appears in the customer-category intake picker
      // (portal + Messenger). Meaningful only for customer-category types.
      intakeVisible: boolean("intake_visible").notNull().default(true),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
      // Archive, never hard-delete in use: archived types keep their ticket
      // history and disappear from pickers.
      deletedAt: timestamp("deleted_at", { withTimezone: true }),
    },
    (table) => [
      // slug uniqueness is covered by the ticket_types_slug_unique constraint.
      // One default per category among live types (partial, mirrors
      // ticket_conversations_customer_uq's shape). The create-dialog
      // preselection and convert_to_ticket's absent-type fallback resolve
      // through this row.
      uniqueIndex("ticket_types_one_default_per_category_uq")
        .on(table.workspaceId, table.category)
        .where(sql`is_default = true AND deleted_at IS NULL`),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      unique().on(table.workspaceId, table.slug),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

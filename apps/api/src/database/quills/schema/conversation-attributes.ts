import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
/**
 * Conversation attribute definitions — the admin-managed registry of custom
 * data attributes for conversations AND tickets (both carry a
 * `custom_attributes` jsonb the keys index into). Values live on the
 * conversation/ticket row as `{ v, src, at }` envelopes; this table only
 * defines the taxonomy: key, label, description, field type, options.
 *
 * Lifecycle is archive-only (`archived_at`): archived definitions disappear
 * from pickers but keep stored values readable/filterable and reserve their
 * key. Field type is immutable after creation; select options are append/
 * rename-by-id only (option ids are what values store, labels are display).
 */
import {
  text,
  timestamp,
  jsonb,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { typeIdWithDefault } from "@kaneo/ids/drizzle";

/** Supported field types (immutable after creation). */
export type ConversationAttributeFieldType =
  | "text"
  | "number"
  | "select"
  | "multi_select"
  | "checkbox"
  | "date";

/**
 * A select/multi_select option. `id` is the stable stored value; `label` is
 * renameable display text; `description` feeds pickers and the AI classifier.
 */
export interface ConversationAttributeOption {
  id: string;
  label: string;
  description?: string | null;
}

/** Display-only hint of the expected writer for a definition. */
export type ConversationAttributeSourceHint = "ai" | "workflow" | "agent";

export const conversationAttributeDefinitions = quillsSchema
  .table(
    "conversation_attribute_definitions",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("conv_attr")("id").notNull(),
      /** Machine key into custom_attributes (normalized snake_case). */
      key: text("key").notNull(),
      label: text("label").notNull(),
      description: text("description"),
      fieldType: text("field_type", {
        enum: ["text", "number", "select", "multi_select", "checkbox", "date"],
      })
        .notNull()
        .$type<ConversationAttributeFieldType>(),
      /** Options for select/multi_select; null for the scalar types. */
      options: jsonb("options").$type<ConversationAttributeOption[] | null>(),
      /** Enforced only on teammate inbox close; API/workflow/AI closes bypass. */
      requiredToClose: boolean("required_to_close").notNull().default(false),
      sourceHint: text(
        "source_hint",
      ).$type<ConversationAttributeSourceHint | null>(),
      /**
       * Opt in to deterministic AI classification at the "job done" moments
       * (handoff, assistant close, inactivity close). `select` field type only —
       * enforced at the service layer, not here. Off by default: an admin must
       * explicitly opt an attribute in.
       */
      aiDetect: boolean("ai_detect").notNull().default(false),
      /** Re-run classification for this attribute when a teammate closes the
       *  conversation, in addition to the standard "job done" moments. Only
       *  meaningful alongside `aiDetect`; `select` field type only. */
      detectOnClose: boolean("detect_on_close").notNull().default(false),
      /** Archive-only lifecycle: set = hidden from pickers, key stays reserved. */
      archivedAt: timestamp("archived_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
    },
    (t) => [
      uniqueIndex("conversation_attribute_definitions_key_idx").on(
        t.workspaceId,
        t.key,
      ),
      primaryKey({ columns: [t.workspaceId, t.id] }),
      workspacePolicy(t.workspaceId),
    ],
  )
  .enableRLS();

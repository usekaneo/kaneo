import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
/**
 * User Attribute Definitions schema
 *
 * Admin-defined custom attributes that map to keys in user.metadata (JSONB).
 * These appear as first-class segment rule options and can be used for
 * segment weighting (e.g., MRR, company size, contract value).
 */
import { text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { generateId } from "@kaneo/ids";
import { typeIdTextColumn } from "@kaneo/ids/drizzle";

/** Supported data types for user attributes */
export type UserAttributeType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "currency";

/** Currency code (ISO 4217) for currency-type attributes */
export type CurrencyCode =
  | "USD"
  | "EUR"
  | "GBP"
  | "JPY"
  | "CAD"
  | "AUD"
  | "CHF"
  | "CNY"
  | "INR"
  | "BRL";

export const userAttributeDefinitions = quillsSchema
  .table(
    "user_attribute_definitions",
    {
      workspaceId: workspaceColumn(),
      // text, not uuid — the original migration stored the UUID form as text
      // (see typeIdTextColumn). A later uuid migration can switch to typeIdWithDefault.
      id: typeIdTextColumn("user_attr")("id")
        .$defaultFn(() => generateId("user_attr"))
        .notNull(),
      /** The JSON key inside user.metadata, e.g. "mrr", "company_size" */
      key: text("key").notNull(),
      /** Human-readable label shown in the UI, e.g. "Monthly Revenue" */
      label: text("label").notNull(),
      /** Optional description / help text */
      description: text("description"),
      /** Data type — controls available operators and value input in segment builder */
      type: text("type", {
        enum: ["string", "number", "boolean", "date", "currency"],
      })
        .notNull()
        .$type<UserAttributeType>(),
      /** ISO 4217 code — only populated when type = 'currency' */
      currencyCode: text("currency_code").$type<CurrencyCode | null>(),
      /**
       * Optional external key for CDP integrations (e.g. Segment trait name).
       * When set, the inbound CDP handler maps this external name → the internal `key`.
       * Falls back to `key` if not provided.
       */
      externalKey: text("external_key"),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
    },
    (t) => [
      uniqueIndex("user_attr_key_idx").on(t.workspaceId, t.key),
      primaryKey({ columns: [t.workspaceId, t.id] }),
      workspacePolicy(t.workspaceId),
    ],
  )
  .enableRLS();

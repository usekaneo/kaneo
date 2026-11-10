import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
/**
 * Company Attribute Definitions schema
 *
 * Admin-defined custom attributes that map to keys in companies.custom_attributes
 * (JSONB). Mirrors user_attribute_definitions exactly: these appear as
 * first-class company predicates in the segment rule builder and as typed
 * editors on the company profile.
 */
import { text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { generateId } from "@kaneo/ids";
import { typeIdTextColumn } from "@kaneo/ids/drizzle";
import type { UserAttributeType, CurrencyCode } from "./user-attributes";

export const companyAttributeDefinitions = quillsSchema
  .table(
    "company_attribute_definitions",
    {
      workspaceId: workspaceColumn(),
      id: typeIdTextColumn("company_attr")("id")
        .$defaultFn(() => generateId("company_attr"))
        .notNull(),
      /** The JSON key inside companies.custom_attributes, e.g. "region", "seats" */
      key: text("key").notNull(),
      /** Human-readable label shown in the UI, e.g. "Contract value" */
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
       * Optional external key for CRM/CDP integrations. When set, the inbound
       * handler maps this external name → the internal `key`. Falls back to
       * `key` if not provided.
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
      uniqueIndex("company_attr_key_idx").on(t.workspaceId, t.key),
      primaryKey({ columns: [t.workspaceId, t.id] }),
      workspacePolicy(t.workspaceId),
    ],
  )
  .enableRLS();

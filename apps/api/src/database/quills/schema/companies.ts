import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
/**
 * Companies — the B2B company / account object (support platform §4.4).
 *
 * A company groups the people who belong to one customer organization and
 * carries the plan / MRR context agents see inline in the inbox. People link to
 * a company via `principal.company_id` (nullable, soft-owned FK, set null on
 * delete). Tickets gain a `company_id` when the support platform lands.
 */
import {
  text,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { typeIdWithDefault } from "@kaneo/ids/drizzle";
import { principal } from "./auth";

export const companies = quillsSchema
  .table(
    "companies",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("company")("id").notNull(),
      name: text("name").notNull(),
      // Email domain that maps people to this company; case-insensitively unique.
      domain: text("domain"),
      // External CRM identifier for linkage; unique when present.
      externalId: text("external_id"),
      // Free-text plan label (e.g. "Scale") shown in the agent sidebar.
      plan: text("plan"),
      // Monthly recurring revenue in minor units (cents), for sidebar context.
      mrrCents: integer("mrr_cents"),
      // Qualification standard fields (§K2): free-text, editable from the inbox
      // sidebar for an unattached contact and from the company profile.
      size: text("size"),
      website: text("website"),
      industry: text("industry"),
      // How the record came to exist: 'api' (SDK/REST/CRM sync) or 'manual'
      // (agent qualification). ONE record type with a source column — never a
      // separate "qualification company" shadow object.
      source: text("source").$type<"api" | "manual">().notNull().default("api"),
      // Arbitrary CRM-synced attributes.
      customAttributes: jsonb("custom_attributes")
        .$type<Record<string, unknown>>()
        .notNull()
        .default({}),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
    },
    (table) => [
      // One company per email domain, case-insensitive (LOWER functional index).
      // Partial so unset domains never collide.
      uniqueIndex("companies_domain_lower_idx")
        .on(table.workspaceId, sql`LOWER(${table.domain})`)
        .where(sql`"domain" IS NOT NULL`),
      // CRM linkage id, unique when present.
      uniqueIndex("companies_external_id_idx")
        .on(table.workspaceId, table.externalId)
        .where(sql`"external_id" IS NOT NULL`),
      // Workspace search matches a name or domain anywhere inside (0309).
      index("companies_name_trgm_idx").using(
        "gin",
        table.name.op("gin_trgm_ops"),
      ),
      index("companies_domain_trgm_idx").using(
        "gin",
        table.domain.op("gin_trgm_ops"),
      ),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const companiesRelations = relations(companies, ({ many }) => ({
  people: many(principal),
}));

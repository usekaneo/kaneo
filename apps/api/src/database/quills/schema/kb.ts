import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { foreignKey, primaryKey } from "drizzle-orm/pg-core";
import {
  text,
  timestamp,
  integer,
  boolean,
  index,
  uniqueIndex,
  jsonb,
  uuid,
  customType,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import {
  typeIdWithDefault,
  typeIdColumn,
  typeIdColumnNullable,
} from "@kaneo/ids/drizzle";
import { principal } from "./auth";
import type { TiptapContent } from "../types";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

const vector = customType<{ data: number[] }>({
  dataType() {
    return "vector(1536)";
  },
});

// ============================================
// Locale -> Postgres text-search config (domains/languages §2)
// ============================================

/**
 * Locale -> Postgres regconfig for per-locale keyword FTS. Stock Postgres
 * ships no CJK tokenizer, so zh-cn/zh-tw fall back to 'simple' (whitespace/
 * punctuation tokenizing, no stemming) rather than a language-specific
 * config. This is the single source of truth: {@link localeRegconfigCaseSql}
 * generates the migration's GENERATED column expression from it, and the
 * help-center search service imports it to build matching tsquery calls.
 */
export const LOCALE_TO_REGCONFIG: Record<string, string> = {
  en: "english",
  de: "german",
  fr: "french",
  es: "spanish",
  ar: "arabic",
  ru: "russian",
  nl: "dutch",
  "pt-br": "portuguese",
  "zh-cn": "simple",
  "zh-tw": "simple",
};

export function regconfigForLocale(locale: string): string {
  return LOCALE_TO_REGCONFIG[locale] ?? "english";
}

/**
 * SQL `CASE <localeExpr> WHEN ... THEN '<regconfig>'::regconfig ... END`,
 * generated from {@link LOCALE_TO_REGCONFIG} so the generated tsvector column
 * and the raw migration SQL can never drift apart. Safe to inline directly
 * (no interpolated user input -- every value comes from the static map).
 *
 * The cast sits INSIDE each branch: casting a string literal to regconfig is
 * folded to a constant at parse time, which keeps the whole CASE immutable.
 * Casting the CASE RESULT (text -> regconfig at runtime) is only STABLE and
 * Postgres rejects it in GENERATED columns (42P17).
 */
export function localeRegconfigCaseSql(localeExpr: string): string {
  const whens = Object.entries(LOCALE_TO_REGCONFIG)
    .filter(([, cfg]) => cfg !== "english")
    .map(([locale, cfg]) => `WHEN '${locale}' THEN '${cfg}'::regconfig`)
    .join(" ");
  return `CASE ${localeExpr} ${whens} ELSE 'english'::regconfig END`;
}

// ============================================
// Help Center Categories
// ============================================

export const helpCenterCategories = quillsSchema
  .table(
    "kb_categories",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("kb_category")("id").notNull(),
      parentId: typeIdColumnNullable("kb_category")("parent_id"),
      slug: text("slug").notNull(),
      name: text("name").notNull(),
      description: text("description"),
      icon: text("icon"),
      isPublic: boolean("is_public").default(true).notNull(),
      // Segments a PUBLIC category is restricted to; [] = everyone. Ignored when
      // isPublic=false (team-only). Articles inherit their category's gate.
      segmentIds: jsonb("segment_ids").$type<string[]>().notNull().default([]),
      position: integer("position").default(0).notNull(),
      /** Public numeric id used in `/hc/{locale}/collections/{urlId}-{slug}`. */
      urlId: integer("url_id").generatedByDefaultAsIdentity().notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      deletedAt: timestamp("deleted_at", { withTimezone: true }),
    },
    (table) => [
      uniqueIndex("kb_categories_slug_idx").on(table.workspaceId, table.slug),
      uniqueIndex("kb_categories_url_id_idx").on(
        table.workspaceId,
        table.urlId,
      ),
      index("kb_categories_position_idx").on(table.position),
      index("kb_categories_deleted_at_idx").on(table.deletedAt),
      index("kb_categories_parent_id_idx").on(table.parentId),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.parentId],
        foreignColumns: [table.workspaceId, table.id],
      }).onDelete("set null"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

// ============================================
// Help Center Articles
// ============================================

export const helpCenterArticles = quillsSchema
  .table(
    "kb_articles",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("article")("id").notNull(),
      categoryId: typeIdColumn("kb_category")("category_id").notNull(),
      slug: text("slug").notNull(),
      title: text("title").notNull(),
      description: text("description"),
      position: integer("position"),
      content: text("content").notNull(),
      contentJson: jsonb("content_json").$type<TiptapContent>(),
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      publishedAt: timestamp("published_at", { withTimezone: true }),
      // Segments a PUBLISHED article is restricted to; [] = everyone. Layers on
      // top of the parent category's gate: a public reader must pass both.
      segmentIds: jsonb("segment_ids").$type<string[]>().notNull().default([]),
      viewCount: integer("view_count").default(0).notNull(),
      helpfulCount: integer("helpful_count").default(0).notNull(),
      notHelpfulCount: integer("not_helpful_count").default(0).notNull(),
      /** Public numeric id used in `/hc/{locale}/articles/{urlId}-{slug}`. */
      urlId: integer("url_id").generatedByDefaultAsIdentity().notNull(),
      searchVector: tsvector("search_vector").generatedAlwaysAs(
        sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(content, '')), 'B')`,
      ),
      embedding: vector("embedding"),
      embeddingModel: text("embedding_model"),
      embeddingUpdatedAt: timestamp("embedding_updated_at", {
        withTimezone: true,
      }),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      deletedAt: timestamp("deleted_at", { withTimezone: true }),
    },
    (table) => [
      uniqueIndex("kb_articles_slug_idx").on(table.workspaceId, table.slug),
      uniqueIndex("kb_articles_url_id_idx").on(table.workspaceId, table.urlId),
      index("kb_articles_principal_id_idx").on(table.principalId),
      index("kb_articles_published_at_idx").on(table.publishedAt),
      index("kb_articles_deleted_at_idx").on(table.deletedAt),
      index("kb_articles_category_published_idx").on(
        table.categoryId,
        table.publishedAt,
      ),
      index("kb_articles_category_position_idx").on(
        table.categoryId,
        table.position,
      ),
      index("kb_articles_search_vector_idx").using("gin", table.searchVector),
      // Workspace search: a title containing the query anywhere inside (0309).
      index("kb_articles_title_trgm_idx").using(
        "gin",
        table.title.op("gin_trgm_ops"),
      ),
      index("kb_articles_embedding_hnsw_idx")
        .using("hnsw", sql`${table.embedding} vector_cosine_ops`)
        .where(sql`${table.embedding} IS NOT NULL`),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.categoryId],
        foreignColumns: [
          helpCenterCategories.workspaceId,
          helpCenterCategories.id,
        ],
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("restrict"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

// ============================================
// Article Feedback (helpful/not helpful)
// ============================================

export const helpCenterArticleFeedback = quillsSchema
  .table(
    "kb_article_feedback",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("kb_article_feedback")("id").notNull(),
      articleId: typeIdColumn("article")("article_id").notNull(),
      principalId: typeIdColumnNullable("principal")("principal_id"),
      helpful: boolean("helpful").notNull(),
      /**
       * Free-text explanation of an unhelpful vote. Null on helpful votes and on
       * unhelpful votes whose author never elaborated -- a reason belongs to the
       * unhelpful vote it explains, so flipping a vote to helpful clears it.
       */
      reason: text("reason"),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      uniqueIndex("kb_article_feedback_unique_idx").on(
        table.workspaceId,
        table.articleId,
        table.principalId,
      ),
      // Backs the admin-side reason list for one article (newest first).
      index("kb_article_feedback_reason_idx")
        .on(table.articleId, table.createdAt)
        .where(sql`${table.reason} IS NOT NULL`),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.articleId],
        foreignColumns: [helpCenterArticles.workspaceId, helpCenterArticles.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

// ============================================
// Redirect Rules (domains/languages §2)
// ============================================

/**
 * Admin-defined path -> published article|category 301s for the /hc site.
 * `targetType`/`targetId` is a polymorphic reference with no FK constraint
 * (a single FK can't span kb_articles and kb_categories) -- the owning
 * article/category service deletes orphaned rules explicitly on hard delete.
 */
export const helpCenterRedirectRules = quillsSchema
  .table(
    "hc_redirect_rules",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("hc_redirect_rule")("id").notNull(),
      path: text("path").notNull(),
      targetType: text("target_type").$type<"article" | "category">().notNull(),
      targetId: text("target_id").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      uniqueIndex("hc_redirect_rules_path_idx").on(
        table.workspaceId,
        table.path,
      ),
      index("hc_redirect_rules_target_idx").on(
        table.targetType,
        table.targetId,
      ),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

// ============================================
// Visitor Search Queries
// ============================================

/**
 * Append-only log of visitor help-center searches (portal /hc box and
 * widget). `normalizedQuery` (trimmed, whitespace-collapsed, lowercased) is
 * the grouping key for the admin search-term analytics; `query` keeps a raw
 * exemplar for display. No principal reference: visitors are usually
 * anonymous, so rows carry no identity at all. Plain uuid PK — a typeId
 * prefix buys nothing on a high-volume log table.
 */
export const helpCenterSearchQueries = quillsSchema
  .table(
    "kb_search_queries",
    {
      workspaceId: workspaceColumn(),
      id: uuid("id").defaultRandom().notNull(),
      query: text("query").notNull(),
      normalizedQuery: text("normalized_query").notNull(),
      locale: text("locale").notNull(),
      resultsCount: integer("results_count").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      // Backs the admin aggregation's time-window filter.
      index("kb_search_queries_created_at_idx").on(table.createdAt),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

// ============================================
// Translations (domains/languages §2)
// ============================================

/**
 * Per-article translation variants (not chrome-only): default locale content
 * lives on kb_articles itself; every additional locale is a row here.
 * `status` is independent of the base article's publishedAt -- a translation
 * can be a draft while the base article is published, or vice versa. Only
 * `published` translations are visible on the public /hc/{locale} site.
 */
export const helpCenterArticleTranslations = quillsSchema
  .table(
    "kb_article_translations",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("kb_article_translation")("id").notNull(),
      articleId: typeIdColumn("article")("article_id").notNull(),
      locale: text("locale").notNull(),
      title: text("title").notNull().default(""),
      description: text("description"),
      content: text("content").notNull().default(""),
      contentJson: jsonb("content_json").$type<TiptapContent>(),
      status: text("status")
        .$type<"draft" | "published">()
        .notNull()
        .default("draft"),
      searchVector: tsvector("search_vector").generatedAlwaysAs(
        sql`setweight(to_tsvector(${sql.raw(localeRegconfigCaseSql("locale"))}, coalesce(title, '')), 'A') || setweight(to_tsvector(${sql.raw(localeRegconfigCaseSql("locale"))}, coalesce(content, '')), 'B')`,
      ),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      uniqueIndex("kb_article_translations_unique_idx").on(
        table.workspaceId,
        table.articleId,
        table.locale,
      ),
      index("kb_article_translations_locale_idx").on(table.locale),
      index("kb_article_translations_search_vector_idx").using(
        "gin",
        table.searchVector,
      ),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.articleId],
        foreignColumns: [helpCenterArticles.workspaceId, helpCenterArticles.id],
      }).onDelete("cascade"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/**
 * Per-category translation variants. No `status` column -- a category's
 * presence in a locale is purely "does a translation row with a non-empty
 * name exist", per the homepage visibility gate (domains/languages §1).
 */
export const helpCenterCategoryTranslations = quillsSchema
  .table(
    "kb_category_translations",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("kb_category_translation")("id").notNull(),
      categoryId: typeIdColumn("kb_category")("category_id").notNull(),
      locale: text("locale").notNull(),
      name: text("name").notNull().default(""),
      description: text("description"),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      uniqueIndex("kb_category_translations_unique_idx").on(
        table.workspaceId,
        table.categoryId,
        table.locale,
      ),
      index("kb_category_translations_locale_idx").on(table.locale),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.categoryId],
        foreignColumns: [
          helpCenterCategories.workspaceId,
          helpCenterCategories.id,
        ],
      }).onDelete("cascade"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

// ============================================
// Relations
// ============================================

export const helpCenterCategoriesRelations = relations(
  helpCenterCategories,
  ({ one, many }) => ({
    parent: one(helpCenterCategories, {
      fields: [helpCenterCategories.workspaceId, helpCenterCategories.parentId],
      references: [helpCenterCategories.workspaceId, helpCenterCategories.id],
      relationName: "categoryParent",
    }),
    children: many(helpCenterCategories, { relationName: "categoryParent" }),
    articles: many(helpCenterArticles),
    translations: many(helpCenterCategoryTranslations),
  }),
);

export const helpCenterArticlesRelations = relations(
  helpCenterArticles,
  ({ one, many }) => ({
    category: one(helpCenterCategories, {
      fields: [helpCenterArticles.workspaceId, helpCenterArticles.categoryId],
      references: [helpCenterCategories.workspaceId, helpCenterCategories.id],
    }),
    author: one(principal, {
      fields: [helpCenterArticles.workspaceId, helpCenterArticles.principalId],
      references: [principal.workspaceId, principal.id],
      relationName: "helpCenterArticleAuthor",
    }),
    feedback: many(helpCenterArticleFeedback),
    translations: many(helpCenterArticleTranslations),
  }),
);

export const helpCenterArticleFeedbackRelations = relations(
  helpCenterArticleFeedback,
  ({ one }) => ({
    article: one(helpCenterArticles, {
      fields: [
        helpCenterArticleFeedback.workspaceId,
        helpCenterArticleFeedback.articleId,
      ],
      references: [helpCenterArticles.workspaceId, helpCenterArticles.id],
    }),
    principal: one(principal, {
      fields: [
        helpCenterArticleFeedback.workspaceId,
        helpCenterArticleFeedback.principalId,
      ],
      references: [principal.workspaceId, principal.id],
      relationName: "helpCenterFeedbackPrincipal",
    }),
  }),
);

export const helpCenterArticleTranslationsRelations = relations(
  helpCenterArticleTranslations,
  ({ one }) => ({
    article: one(helpCenterArticles, {
      fields: [
        helpCenterArticleTranslations.workspaceId,
        helpCenterArticleTranslations.articleId,
      ],
      references: [helpCenterArticles.workspaceId, helpCenterArticles.id],
    }),
  }),
);

export const helpCenterCategoryTranslationsRelations = relations(
  helpCenterCategoryTranslations,
  ({ one }) => ({
    category: one(helpCenterCategories, {
      fields: [
        helpCenterCategoryTranslations.workspaceId,
        helpCenterCategoryTranslations.categoryId,
      ],
      references: [helpCenterCategories.workspaceId, helpCenterCategories.id],
    }),
  }),
);

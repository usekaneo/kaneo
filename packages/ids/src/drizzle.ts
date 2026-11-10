/**
 * Drizzle ORM custom column types for TypeID
 *
 * These column types store UUIDs in native uuid columns (or text when requested)
 * while exposing TypeID strings to the application layer.
 *
 * Benefits:
 * - Optimal database storage (native UUID type)
 * - Prefix-aware string types in TypeScript
 * - Automatic conversion at ORM boundary
 * - UUIDv7 for time-ordered IDs (better index performance)
 */

import { customType } from "drizzle-orm/pg-core";
import { generateId, fromUuid, normalizeToUuid } from "./core";
import type { IdPrefix } from "./prefixes";
import type { TypeId } from "./types";

/** Native columns retain Better Auth's UUID groups with optional dashes. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

/**
 * Custom Drizzle column type for TypeID
 *
 * Stores as native UUID in PostgreSQL (16 bytes),
 * converts to/from TypeID at the application layer.
 *
 * @param prefix - The entity type prefix
 * @returns A custom column builder
 *
 * @example
 * export const posts = pgTable('posts', {
 *   id: typeIdColumn('post')('id').primaryKey(),
 *   boardId: typeIdColumn('board')('board_id').notNull(),
 * })
 */
export function typeIdColumn<P extends IdPrefix>(prefix: P) {
  return customType<{
    data: TypeId<P>;
    driverData: string;
  }>({
    dataType() {
      return "uuid";
    },
    toDriver(value: TypeId<P>): string {
      // Handle raw UUIDs (e.g., from Better Auth's internal adapter)
      // Better Auth sometimes passes raw UUIDs when linking accounts
      if (UUID_PATTERN.test(value)) {
        return value;
      }
      // Convert TypeID to UUID for database storage
      return normalizeToUuid(value, prefix);
    },
    fromDriver(value: unknown): TypeId<P> {
      // Convert UUID from database to TypeID
      if (typeof value !== "string") {
        throw new Error(`Expected string from database, got ${typeof value}`);
      }
      return fromUuid(prefix, value);
    },
  });
}

/**
 * TypeID column with nullable support
 *
 * For nullable foreign keys that reference TypeID columns.
 *
 * @param prefix - The entity type prefix
 * @returns A custom column builder that handles null
 *
 * @example
 * export const unsubscribeTokens = pgTable('unsubscribe_tokens', {
 *   postId: typeIdColumnNullable('post')('post_id').references(() => posts.id),
 * })
 */
export function typeIdColumnNullable<P extends IdPrefix>(prefix: P) {
  return customType<{
    data: TypeId<P> | null;
    driverData: string | null;
  }>({
    dataType() {
      return "uuid";
    },
    toDriver(value: TypeId<P> | null): string | null {
      if (value === null) return null;
      // Handle raw UUIDs (e.g., from Better Auth's internal adapter)
      if (UUID_PATTERN.test(value)) {
        return value;
      }
      return normalizeToUuid(value, prefix);
    },
    fromDriver(value: unknown): TypeId<P> | null {
      if (value === null || value === undefined) return null;
      if (typeof value !== "string") {
        throw new Error(`Expected string from database, got ${typeof value}`);
      }
      return fromUuid(prefix, value);
    },
  });
}

/**
 * TypeID column with automatic UUIDv7 generation
 *
 * Generates a new UUIDv7-based TypeID when inserting without explicit ID.
 *
 * @param prefix - The entity type prefix
 * @returns A custom column builder with default generation
 *
 * @example
 * export const posts = pgTable('posts', {
 *   id: typeIdWithDefault('post')('id').primaryKey(),
 *   // When inserting: { title: 'New Post' }
 *   // ID is auto-generated: 'post_01h455vb4pex5vsknk084sn02q'
 * })
 */
export function typeIdWithDefault<P extends IdPrefix>(prefix: P) {
  return (columnName: string) =>
    typeIdColumn(prefix)(columnName).$defaultFn(() => generateId(prefix));
}

/**
 * Create a reference column that accepts TypeID for a foreign key
 *
 * This is a convenience function for defining foreign key columns
 * that accept TypeID input but store as UUID.
 *
 * @param prefix - The expected prefix for the referenced entity
 * @returns A column builder for foreign key usage
 *
 * @example
 * export const posts = pgTable('posts', {
 *   boardId: typeIdReference('board')('board_id')
 *     .notNull()
 *     .references(() => boards.id),
 * })
 */
export function typeIdReference<P extends IdPrefix>(prefix: P) {
  return typeIdColumn(prefix);
}

/**
 * TypeID column stored as `text` holding the UUID form.
 *
 * Used when a migration created the id as text rather than uuid, so the
 * standard `typeIdColumn` (uuid) would drift from the live schema. App-layer
 * conversion is identical; a follow-up migration to uuid can revert the
 * table to `typeIdWithDefault`.
 */
export function typeIdTextColumn<P extends IdPrefix>(prefix: P) {
  return customType<{ data: TypeId<P>; driverData: string }>({
    dataType() {
      return "text";
    },
    toDriver(value: TypeId<P>): string {
      return normalizeToUuid(value, prefix);
    },
    fromDriver(value: unknown): TypeId<P> {
      if (typeof value !== "string") {
        throw new Error(`Expected string from database, got ${typeof value}`);
      }
      return fromUuid(prefix, value);
    },
  });
}

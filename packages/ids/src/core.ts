/**
 * Core TypeID generation and conversion functions
 *
 * TypeID format: {prefix}_{base32_encoded_uuid}
 * Example: post_01h455vb4pex5vsknk084sn02q
 *
 * Generated IDs use time-ordered UUIDv7. Conversions preserve any 128-bit UUID.
 */

import { typeid, TypeID } from "typeid-js";
import {
  ID_PREFIXES,
  ID_PREFIX_ALIASES,
  prefixMatches,
  type IdPrefix,
  type EntityType,
} from "./prefixes";
import type { TypeId, EntityIdMap } from "./types";

/**
 * Dashed UUID shape, intentionally without version/variant restrictions.
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================
// Generation Functions
// ============================================

/**
 * Generate a new TypeID with UUIDv7 for the given prefix
 *
 * @param prefix - The entity type prefix (e.g., 'post', 'board')
 * @returns A new TypeID string with the prefix and a UUIDv7-based suffix
 *
 * @example
 * const id = generateId('post')
 * // => 'post_01h455vb4pex5vsknk084sn02q'
 */
export function generateId<P extends IdPrefix>(prefix: P): TypeId<P> {
  // typeid() returns `${P}_${string}` which matches our TypeId<P>
  return typeid(prefix).toString() as TypeId<P>;
}

/**
 * Generate a new TypeID for a given entity type
 *
 * @param entity - The entity type key (e.g., 'post', 'board')
 * @returns A new TypeID string
 *
 * @example
 * const id = createId('post')
 * // => 'post_01h455vb4pex5vsknk084sn02q'
 */
export function createId<E extends EntityType>(entity: E): EntityIdMap[E] {
  const prefix = ID_PREFIXES[entity];
  return generateId(prefix) as EntityIdMap[E];
}

// ============================================
// Conversion Functions
// ============================================

/**
 * Convert a TypeID string to its underlying UUID
 *
 * @param typeIdString - A TypeID string (e.g., 'post_01h455vb4pex5vsknk084sn02q')
 * @returns The underlying UUID string
 * @throws Error if the TypeID format is invalid
 *
 * @example
 * const uuid = toUuid('post_01h455vb4pex5vsknk084sn02q')
 * // => '01890a5d-ac96-774b-bcce-b302099a8057'
 */
export function toUuid(typeIdString: string): string {
  return parseTypeId(typeIdString).uuid;
}

/**
 * Convert a UUID to a TypeID string with the given prefix
 *
 * @param prefix - The entity type prefix
 * @param uuid - A UUID string (any version)
 * @returns A TypeID string combining the prefix and encoded UUID
 * @throws Error if the UUID format is invalid
 *
 * @example
 * const typeId = fromUuid('post', '01890a5d-ac96-774b-bcce-b302099a8057')
 * // => 'post_01h455vb4pex5vsknk084sn02q'
 */
export function fromUuid<P extends IdPrefix>(
  prefix: P,
  uuid: string,
): TypeId<P> {
  if (!isUuid(uuid)) {
    throw new Error(`Invalid UUID format: ${uuid}`);
  }
  return TypeID.fromUUID(prefix, uuid).toString() as TypeId<P>;
}

/**
 * Parse a TypeID string into its components
 *
 * @param typeIdString - A TypeID string
 * @param expectedPrefix - Optional canonical prefix; its retired aliases are accepted
 * @returns Object with prefix and uuid properties
 * @throws Error if the TypeID format is invalid
 *
 * @example
 * const { prefix, uuid } = parseTypeId('post_01h455vb4pex5vsknk084sn02q')
 * // => { prefix: 'post', uuid: '01890a5d-ac96-774b-bcce-b302099a8057' }
 */
export function parseTypeId(
  typeIdString: string,
  expectedPrefix?: IdPrefix,
): { prefix: string; uuid: string } {
  const tid = TypeID.fromString(typeIdString);
  const prefix = tid.getType();
  if (expectedPrefix && !prefixMatches(prefix, expectedPrefix)) {
    throw new Error(`Expected ${expectedPrefix} ID, got ${prefix} ID`);
  }
  // toUUID() rejects nonstandard version/variant bits accepted by fromUuid().
  const hex = Array.from(tid.toUUIDBytes(), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return {
    prefix,
    uuid: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`,
  };
}

/**
 * Get just the prefix from a TypeID string
 *
 * @param typeIdString - A TypeID string
 * @returns The prefix portion
 * @throws Error if the TypeID format is invalid
 */
export function getTypeIdPrefix(typeIdString: string): string {
  return TypeID.fromString(typeIdString).getType();
}

// ============================================
// Validation Functions
// ============================================

/**
 * Check if a string is a valid TypeID, optionally checking prefix
 *
 * @param value - The string to validate
 * @param expectedPrefix - Optional prefix to validate against
 * @returns true if the string is a valid TypeID (with matching prefix if specified)
 *
 * @example
 * isValidTypeId('post_01h455vb4pex5vsknk084sn02q') // true
 * isValidTypeId('post_01h455vb4pex5vsknk084sn02q', 'post') // true
 * isValidTypeId('post_01h455vb4pex5vsknk084sn02q', 'board') // false
 * isValidTypeId('invalid') // false
 */
export function isValidTypeId(
  value: string,
  expectedPrefix?: IdPrefix,
): boolean {
  try {
    parseTypeId(value, expectedPrefix);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard for a TypeID whose serialized prefix is exactly `prefix`.
 * Retired aliases (`kb_article_…`) are valid inbound article ids via
 * `isValidTypeId` / `ensureTypeId`, but they are not `TypeId<'article'>`.
 */
export function isTypeId<P extends IdPrefix>(
  value: string,
  prefix: P,
): value is TypeId<P> {
  try {
    return parseTypeId(value).prefix === prefix;
  } catch {
    return false;
  }
}

/**
 * Check dashed UUID shape, without restricting version or variant bits.
 *
 * @param value - The string to check
 * @returns true if the string is a valid UUID format
 */
export function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Validate the full generic TypeID format using the parser, including prefixless IDs.
 * A valid format does not imply a registered application prefix.
 *
 * @param value - The string to check
 * @returns true if parsing and UUID conversion succeed
 */
export function isTypeIdFormat(value: string): boolean {
  return isValidTypeId(value);
}

// ============================================
// Batch Operations
// ============================================

/**
 * Convert multiple UUIDs to TypeIDs with the same prefix
 *
 * @param prefix - The entity type prefix
 * @param uuids - Array of UUID strings
 * @returns Array of TypeID strings
 *
 * @example
 * const typeIds = batchFromUuid('post', [uuid1, uuid2, uuid3])
 */
export function batchFromUuid<P extends IdPrefix>(
  prefix: P,
  uuids: string[],
): TypeId<P>[] {
  return uuids.map((uuid) => fromUuid(prefix, uuid));
}

/**
 * Convert multiple TypeIDs to UUIDs
 *
 * @param typeIds - Array of TypeID strings
 * @returns Array of UUID strings
 *
 * @example
 * const uuids = batchToUuid([typeId1, typeId2, typeId3])
 */
export function batchToUuid(typeIds: string[]): string[] {
  return typeIds.map(toUuid);
}

// ============================================
// Flexible ID Handling (for backward compatibility)
// ============================================

/**
 * Normalize an ID to UUID format
 * Accepts either TypeID or raw UUID, returns UUID
 *
 * @param id - Either a TypeID string or a raw UUID
 * @param expectedPrefix - Optional prefix to validate (only checked for TypeIDs)
 * @returns The UUID string
 * @throws Error if the ID format is invalid
 *
 * @example
 * normalizeToUuid('post_01h455vb4pex5vsknk084sn02q') // => UUID string
 * normalizeToUuid('01890a5d-ac96-774b-bcce-b302099a8057') // => same UUID string
 */
export function normalizeToUuid(id: string, expectedPrefix?: IdPrefix): string {
  // If it's already a UUID, return as-is
  if (isUuid(id)) {
    return id;
  }

  return parseTypeId(id, expectedPrefix).uuid;
}

/**
 * Ensure an ID is in TypeID format
 * Accepts either TypeID or raw UUID, returns TypeID
 *
 * @param id - Either a TypeID string or a raw UUID
 * @param prefix - The prefix to use (required if input might be UUID)
 * @returns The TypeID string
 *
 * @example
 * ensureTypeId('01890a5d-ac96-774b-bcce-b302099a8057', 'post')
 * // => 'post_01h455vb4pex5vsknk084sn02q'
 */
export function ensureTypeId<P extends IdPrefix>(
  id: string,
  prefix: P,
): TypeId<P> {
  if (isUuid(id)) {
    return fromUuid(prefix, id);
  }

  try {
    const parsed = parseTypeId(id, prefix);
    return fromUuid(prefix, parsed.uuid);
  } catch {
    throw new Error(`Invalid ${prefix} ID: ${id}`);
  }
}

/**
 * Canonical TypeID plus retired serialized forms of the same UUID.
 * Use when comparing against text columns or JSON that may still store
 * an alias prefix (e.g. `kb_article_…` after articles emit `article_…`).
 */
export function typeIdLookupKeys(id: string, prefix: IdPrefix): string[] {
  const uuid = normalizeToUuid(id, prefix);
  const canonical = fromUuid(prefix, uuid);
  const aliases = Object.entries(ID_PREFIX_ALIASES)
    .filter(([, mapped]) => mapped === prefix)
    .map(([alias]) => TypeID.fromUUID(alias, uuid).toString());
  return [canonical, ...aliases];
}

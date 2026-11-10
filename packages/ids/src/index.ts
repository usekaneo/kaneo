/**
 * @kaneo/ids - TypeID generation and validation
 *
 * TypeID is a type-safe, sortable identifier format that combines:
 * - Stripe-like prefixes for instant entity recognition
 * - UUIDv7 for time-ordered, database-optimized IDs
 *
 * Format: {prefix}_{base32_encoded_uuid}
 * Example: post_01h455vb4pex5vsknk084sn02q
 *
 * @example
 * import { generateId, toUuid, fromUuid, isValidTypeId } from '@kaneo/ids'
 *
 * // Generate a new TypeID
 * const postId = generateId('post')
 * // => 'post_01h455vb4pex5vsknk084sn02q'
 *
 * // Convert to UUID for database
 * const uuid = toUuid(postId)
 * // => '01890a5d-ac96-774b-bcce-b302099a8057'
 *
 * // Convert back to TypeID
 * const restored = fromUuid('post', uuid)
 * // => 'post_01h455vb4pex5vsknk084sn02q'
 *
 * @packageDocumentation
 */

// ============================================
// Core Functions
// ============================================

export {
  // Generation
  generateId,
  createId,
  // Conversion
  toUuid,
  fromUuid,
  parseTypeId,
  getTypeIdPrefix,
  // Validation
  isValidTypeId,
  isTypeId,
  isUuid,
  isTypeIdFormat,
  // Batch operations
  batchFromUuid,
  batchToUuid,
  // Flexible handling
  normalizeToUuid,
  ensureTypeId,
  typeIdLookupKeys,
} from "./core";

// ============================================
// Prefixes
// ============================================

export {
  ID_PREFIXES,
  ID_PREFIX_ALIASES,
  getPrefix,
  isValidPrefix,
  prefixMatches,
  resolvePrefix,
  type IdPrefix,
  type EntityType,
} from "./prefixes";

// ============================================
// Types
// ============================================

export type * from "./types";

// ============================================
// Re-export Zod schemas from submodule
// ============================================

// Note: For tree-shaking, import directly from '@kaneo/ids/zod'
// These are re-exported here for convenience

export {
  // Schema factories
  typeIdSchema,
  flexibleIdSchema,
  flexibleToTypeIdSchema,
  typeIdArraySchema,
  flexibleIdArraySchema,
  // Generic schemas
  anyTypeIdSchema,
  uuidSchema,
  // Pre-built strict schemas
  postIdSchema,
  boardIdSchema,
  articleIdSchema,
  commentIdSchema,
  voteIdSchema,
  tagIdSchema,
  postStatusIdSchema,
  postCommentReactionIdSchema,
  conversationMessageReactionIdSchema,
  roadmapIdSchema,
  roadmapColumnIdSchema,
  changelogIdSchema,
  conversationIdSchema,
  conversationMessageIdSchema,
  integrationIdSchema,
  workspaceIdSchema,
  userIdSchema,
  principalIdSchema,
  sessionIdSchema,
  inviteIdSchema,
  domainIdSchema,
  segmentIdSchema,
  importRunIdSchema,
  exportRunIdSchema,
  // Pre-built strict schemas - feedback aggregation
  feedbackSourceIdSchema,
  rawFeedbackItemIdSchema,
  feedbackSignalIdSchema,
  externalUserMappingIdSchema,
  // Pre-built flexible schemas
  flexibleSegmentIdSchema,
  flexiblePostIdSchema,
  flexibleBoardIdSchema,
  flexibleCommentIdSchema,
  flexibleVoteIdSchema,
  flexibleTagIdSchema,
  flexiblePostStatusIdSchema,
  flexiblePostCommentReactionIdSchema,
  flexibleConversationMessageReactionIdSchema,
  flexibleRoadmapIdSchema,
  flexibleRoadmapColumnIdSchema,
  flexibleChangelogIdSchema,
  flexibleIntegrationIdSchema,
  flexibleWorkspaceIdSchema,
  flexibleUserIdSchema,
  flexiblePrincipalIdSchema,
  flexibleSessionIdSchema,
  flexibleInviteIdSchema,
  flexibleDomainIdSchema,
  // Pre-built flexible schemas - feedback aggregation
  flexibleFeedbackSourceIdSchema,
  flexibleRawFeedbackItemIdSchema,
  flexibleFeedbackSignalIdSchema,
  flexibleExternalUserMappingIdSchema,
  // Array schemas
  tagIdsSchema,
  postIdsSchema,
} from "./zod";

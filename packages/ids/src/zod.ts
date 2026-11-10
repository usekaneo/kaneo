/**
 * Zod schemas for TypeID validation
 *
 * Provides both strict schemas (TypeID only) and flexible schemas
 * (accepts TypeID or UUID for backward compatibility during migration).
 */

import { z } from "zod";
import { ID_PREFIXES, type IdPrefix } from "./prefixes";
import {
  fromUuid,
  isUuid,
  isValidTypeId,
  normalizeToUuid,
  parseTypeId,
} from "./core";

// ============================================
// Strict TypeID Schemas
// ============================================

/**
 * Create a strict Zod schema that only accepts TypeID format
 * Retired aliases are accepted and rewritten to the canonical prefix.
 *
 * @param prefix - The expected prefix for the TypeID
 * @returns A Zod schema that validates TypeID strings with the given prefix
 *
 * @example
 * const schema = typeIdSchema('post')
 * schema.parse('post_01h455vb4pex5vsknk084sn02q') // OK
 * schema.parse('board_01h455vb4pex5vsknk084sn02q') // Error: wrong prefix
 * schema.parse('550e8400-e29b-41d4-a716-446655440000') // Error: not TypeID format
 */
export function typeIdSchema<P extends IdPrefix>(prefix: P) {
  return z.string().transform((val, ctx) => {
    try {
      return fromUuid(prefix, parseTypeId(val, prefix).uuid);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid ${prefix} ID format. Expected: ${prefix}_<base32>`,
      });
      return z.NEVER;
    }
  });
}

// ============================================
// Flexible ID Schemas (for migration period)
// ============================================

/**
 * Create a flexible Zod schema that accepts TypeID or UUID
 * Normalizes the output to UUID for database storage
 *
 * @param prefix - The expected prefix for TypeID inputs
 * @returns A Zod schema that accepts TypeID or UUID, outputs UUID
 *
 * @example
 * const schema = flexibleIdSchema('post')
 * schema.parse('post_01h455vb4pex5vsknk084sn02q') // => UUID string
 * schema.parse('550e8400-e29b-41d4-a716-446655440000') // => same UUID string
 */
export function flexibleIdSchema<P extends IdPrefix>(prefix: P) {
  return z.string().transform((val, ctx) => {
    try {
      return normalizeToUuid(val, prefix);
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          error instanceof Error
            ? error.message
            : `Invalid ${prefix} ID format`,
      });
      return z.NEVER;
    }
  });
}

/**
 * Create a flexible Zod schema that accepts TypeID or UUID
 * Normalizes the output to TypeID for API responses
 *
 * @param prefix - The prefix to use for the output TypeID
 * @returns A Zod schema that accepts TypeID or UUID, outputs TypeID
 *
 * @example
 * const schema = flexibleToTypeIdSchema('post')
 * schema.parse('550e8400-e29b-41d4-a716-446655440000') // => 'post_2n1t201rmv87aae5j4csam8000'
 * schema.parse('post_01h455vb4pex5vsknk084sn02q') // => same TypeID
 */
export function flexibleToTypeIdSchema<P extends IdPrefix>(prefix: P) {
  return flexibleIdSchema(prefix).transform((uuid, ctx) => {
    try {
      return fromUuid(prefix, uuid);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid ${prefix} ID format`,
      });
      return z.NEVER;
    }
  });
}

/**
 * Validate generic TypeIDs, including prefixless IDs and unregistered prefixes.
 */
export const anyTypeIdSchema = z.string().refine((val) => isValidTypeId(val), {
  message: "Invalid TypeID format",
});

/** Dashed UUID shape only; version and variant bits are intentionally unrestricted. */
export const uuidSchema = z.string().refine(isUuid, "Invalid UUID format");

// ============================================
// Pre-built Schemas for Common Entities
// ============================================

// Strict TypeID schemas (only accept TypeID format)
export const postIdSchema = typeIdSchema(ID_PREFIXES.post);
export const boardIdSchema = typeIdSchema(ID_PREFIXES.board);
export const articleIdSchema = typeIdSchema(ID_PREFIXES.kb_article);
export const commentIdSchema = typeIdSchema(ID_PREFIXES.post_comment);
export const voteIdSchema = typeIdSchema(ID_PREFIXES.post_vote);
export const tagIdSchema = typeIdSchema(ID_PREFIXES.post_tag);
export const postStatusIdSchema = typeIdSchema(ID_PREFIXES.post_status);
export const postCommentReactionIdSchema = typeIdSchema(
  ID_PREFIXES.post_comment_reaction,
);
export const conversationMessageReactionIdSchema = typeIdSchema(
  ID_PREFIXES.conversation_message_reaction,
);
export const roadmapIdSchema = typeIdSchema(ID_PREFIXES.roadmap);
export const roadmapColumnIdSchema = typeIdSchema(ID_PREFIXES.roadmap_column);
export const changelogIdSchema = typeIdSchema(ID_PREFIXES.changelog);
export const conversationIdSchema = typeIdSchema(ID_PREFIXES.conversation);
export const conversationMessageIdSchema = typeIdSchema(
  ID_PREFIXES.conversation_message,
);
export const integrationIdSchema = typeIdSchema(ID_PREFIXES.integration);
export const workspaceIdSchema = typeIdSchema(ID_PREFIXES.workspace);
export const userIdSchema = typeIdSchema(ID_PREFIXES.user);
export const principalIdSchema = typeIdSchema(ID_PREFIXES.principal);
export const sessionIdSchema = typeIdSchema(ID_PREFIXES.session);
export const inviteIdSchema = typeIdSchema(ID_PREFIXES.invite);
export const domainIdSchema = typeIdSchema(ID_PREFIXES.domain);
export const segmentIdSchema = typeIdSchema(ID_PREFIXES.segment);
export const importRunIdSchema = typeIdSchema(ID_PREFIXES.import_run);
export const exportRunIdSchema = typeIdSchema(ID_PREFIXES.export_run);

// Feedback aggregation schemas
export const feedbackSourceIdSchema = typeIdSchema(ID_PREFIXES.feedback_source);
export const rawFeedbackItemIdSchema = typeIdSchema(ID_PREFIXES.raw_feedback);
export const feedbackSignalIdSchema = typeIdSchema(ID_PREFIXES.feedback_signal);
export const externalUserMappingIdSchema = typeIdSchema(
  ID_PREFIXES.user_mapping,
);

// Flexible schemas (accept TypeID or UUID, normalize to UUID)
export const flexibleSegmentIdSchema = flexibleIdSchema(ID_PREFIXES.segment);
export const flexiblePostIdSchema = flexibleIdSchema(ID_PREFIXES.post);
export const flexibleBoardIdSchema = flexibleIdSchema(ID_PREFIXES.board);
export const flexibleCommentIdSchema = flexibleIdSchema(
  ID_PREFIXES.post_comment,
);
export const flexibleVoteIdSchema = flexibleIdSchema(ID_PREFIXES.post_vote);
export const flexibleTagIdSchema = flexibleIdSchema(ID_PREFIXES.post_tag);
export const flexiblePostStatusIdSchema = flexibleIdSchema(
  ID_PREFIXES.post_status,
);
export const flexiblePostCommentReactionIdSchema = flexibleIdSchema(
  ID_PREFIXES.post_comment_reaction,
);
export const flexibleConversationMessageReactionIdSchema = flexibleIdSchema(
  ID_PREFIXES.conversation_message_reaction,
);
export const flexibleRoadmapIdSchema = flexibleIdSchema(ID_PREFIXES.roadmap);
export const flexibleRoadmapColumnIdSchema = flexibleIdSchema(
  ID_PREFIXES.roadmap_column,
);
export const flexibleChangelogIdSchema = flexibleIdSchema(
  ID_PREFIXES.changelog,
);
export const flexibleIntegrationIdSchema = flexibleIdSchema(
  ID_PREFIXES.integration,
);
export const flexibleWorkspaceIdSchema = flexibleIdSchema(
  ID_PREFIXES.workspace,
);
export const flexibleUserIdSchema = flexibleIdSchema(ID_PREFIXES.user);
export const flexiblePrincipalIdSchema = flexibleIdSchema(
  ID_PREFIXES.principal,
);
export const flexibleSessionIdSchema = flexibleIdSchema(ID_PREFIXES.session);
export const flexibleInviteIdSchema = flexibleIdSchema(ID_PREFIXES.invite);
export const flexibleDomainIdSchema = flexibleIdSchema(ID_PREFIXES.domain);
export const flexibleFeedbackSourceIdSchema = flexibleIdSchema(
  ID_PREFIXES.feedback_source,
);
export const flexibleRawFeedbackItemIdSchema = flexibleIdSchema(
  ID_PREFIXES.raw_feedback,
);
export const flexibleFeedbackSignalIdSchema = flexibleIdSchema(
  ID_PREFIXES.feedback_signal,
);
export const flexibleExternalUserMappingIdSchema = flexibleIdSchema(
  ID_PREFIXES.user_mapping,
);

// ============================================
// Array Schemas
// ============================================

/**
 * Create a schema for an array of TypeIDs
 */
export function typeIdArraySchema<P extends IdPrefix>(prefix: P) {
  return z.array(typeIdSchema(prefix));
}

/**
 * Create a schema for an array of flexible IDs (accepts TypeID or UUID)
 */
export function flexibleIdArraySchema<P extends IdPrefix>(prefix: P) {
  return z.array(flexibleIdSchema(prefix));
}

// Pre-built array schemas (strict TypeID only)
export const tagIdsSchema = typeIdArraySchema(ID_PREFIXES.post_tag);
export const postIdsSchema = typeIdArraySchema(ID_PREFIXES.post);

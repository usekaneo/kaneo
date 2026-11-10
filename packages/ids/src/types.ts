/**
 * TypeID type definitions
 *
 * Uses template literal types for compile-time prefix validation
 * while maintaining runtime string compatibility.
 */

import type { EntityType, ID_PREFIXES, IdPrefix } from "./prefixes";

/**
 * TypeID string type with embedded prefix
 *
 * Format: {prefix}_{base32_suffix}
 * Runtime validation enforces a 26-character base32 UUID suffix; this type only enforces the prefix.
 *
 * @example
 * type PostTypeId = TypeId<'post'> // 'post_${string}'
 */
export type TypeId<P extends IdPrefix> = `${P}_${string}`;

// ============================================
// Application Entity IDs
// ============================================

/** Feedback post ID - e.g., post_01h455vb4pex5vsknk084sn02q */
export type PostId = EntityIdMap["post"];

/** Board ID - e.g., board_01h455vb4pex5vsknk084sn02q */
export type BoardId = EntityIdMap["board"];

/** Comment ID - e.g., post_comment_01h455vb4pex5vsknk084sn02q */
export type PostCommentId = EntityIdMap["post_comment"];

/** Vote ID - e.g., post_vote_01h455vb4pex5vsknk084sn02q */
export type PostVoteId = EntityIdMap["post_vote"];

/** PostTag ID - e.g., post_tag_01h455vb4pex5vsknk084sn02q */
export type PostTagId = EntityIdMap["post_tag"];

/** Post status ID - e.g., post_status_01h455vb4pex5vsknk084sn02q */
export type PostStatusId = EntityIdMap["post_status"];

/** Post comment reaction ID - e.g., post_comment_reaction_01h455vb4pex5vsknk084sn02q */
export type PostCommentReactionId = EntityIdMap["post_comment_reaction"];

/** Roadmap ID - e.g., roadmap_01h455vb4pex5vsknk084sn02q */
export type RoadmapId = EntityIdMap["roadmap"];

/** Roadmap column ID - e.g., roadmap_col_01h455vb4pex5vsknk084sn02q */
export type RoadmapColumnId = EntityIdMap["roadmap_column"];

/** Changelog entry ID - e.g., changelog_01h455vb4pex5vsknk084sn02q */
export type ChangelogId = EntityIdMap["changelog"];

/** Changelog category (label) ID - e.g., changelog_category_01h455vb4pex5vsknk084sn02q */
export type ChangelogCategoryId = EntityIdMap["changelog_category"];

/** Changelog subscription ID - e.g., changelog_sub_01h455vb4pex5vsknk084sn02q */
export type ChangelogSubscriptionId = EntityIdMap["changelog_sub"];

/** Status page component ID - e.g., status_component_01h455vb4pex5vsknk084sn02q */
export type StatusComponentId = EntityIdMap["status_component"];

/** Status page component group ID - e.g., status_group_01h455vb4pex5vsknk084sn02q */
export type StatusComponentGroupId = EntityIdMap["status_group"];

/** Status incident/maintenance ID - e.g., status_incident_01h455vb4pex5vsknk084sn02q */
export type StatusIncidentId = EntityIdMap["status_incident"];

/** Status incident update / component event ID - e.g., status_update_01h455vb4pex5vsknk084sn02q */
export type StatusUpdateId = EntityIdMap["status_update"];

/** Status page subscription ID - e.g., status_sub_01h455vb4pex5vsknk084sn02q */
export type StatusSubscriptionId = EntityIdMap["status_sub"];

/** Status incident template ID - e.g., status_tmpl_01h455vb4pex5vsknk084sn02q */
export type StatusIncidentTemplateId = EntityIdMap["status_tmpl"];

/** Support-inbox conversation ID - e.g., conversation_01h455vb4pex5vsknk084sn02q */
export type ConversationId = EntityIdMap["conversation"];

/** Conversation message ID - e.g., conversation_msg_01h455vb4pex5vsknk084sn02q */
export type ConversationMessageId = EntityIdMap["conversation_message"];

/** Conversation tag ID - e.g., conversation_tag_01h455vb4pex5vsknk084sn02q */
export type ConversationTagId = EntityIdMap["conversation_tag"];

/** Conversation message @-mention ID - e.g., conversation_msg_mention_01h455vb4pex5vsknk084sn02q */
export type ConversationMessageMentionId =
  EntityIdMap["conversation_message_mention"];

/** Conversation message reaction ID - e.g., conversation_msg_reaction_01h455vb4pex5vsknk084sn02q */
export type ConversationMessageReactionId =
  EntityIdMap["conversation_message_reaction"];

/** Conversation summary ID (Quinn past-conversation grounding) - e.g., conversation_summary_01h455vb4pex5vsknk084sn02q */
export type ConversationSummaryId = EntityIdMap["conversation_summary"];

/** Conversation message translation ID (P2-D.1 inbox translation cache) - e.g., conversation_msg_translation_01h455vb4pex5vsknk084sn02q */
export type ConversationMessageTranslationId =
  EntityIdMap["conversation_message_translation"];

/** Integration ID - e.g., integration_01h455vb4pex5vsknk084sn02q */
export type IntegrationId = EntityIdMap["integration"];

/** Platform credential ID - e.g., platform_cred_01h455vb4pex5vsknk084sn02q */
export type PlatformCredentialId = EntityIdMap["platform_cred"];

/** Event mapping ID - e.g., event_mapping_01h455vb4pex5vsknk084sn02q */
export type EventMappingId = EntityIdMap["event_mapping"];

/** Post external link ID - e.g., post_external_link_01h455vb4pex5vsknk084sn02q */
export type PostExternalLinkId = EntityIdMap["post_external_link"];

/** Ticket external link ID - e.g., ticket_external_link_01h455vb4pex5vsknk084sn02q */
export type TicketExternalLinkId = EntityIdMap["ticket_external_link"];

/** Slack channel monitor ID - e.g., slack_monitor_01h455vb4pex5vsknk084sn02q */
export type SlackMonitorId = EntityIdMap["slack_monitor"];

/** Import run ID - e.g., import_run_01h455vb4pex5vsknk084sn02q */
export type ImportRunId = EntityIdMap["import_run"];

/** Export run ID - e.g., export_run_01h455vb4pex5vsknk084sn02q */
export type ExportRunId = EntityIdMap["export_run"];

/** Post subscription ID - e.g., post_sub_01h455vb4pex5vsknk084sn02q */
export type PostSubscriptionId = EntityIdMap["post_subscription"];

/** Notification preference ID - e.g., notif_pref_01h455vb4pex5vsknk084sn02q */
export type NotifPrefId = EntityIdMap["notif_pref"];

/** Unsubscribe token ID - e.g., unsub_token_01h455vb4pex5vsknk084sn02q */
export type UnsubTokenId = EntityIdMap["unsub_token"];

/** In-app notification ID - e.g., notification_01h455vb4pex5vsknk084sn02q */
export type NotificationId = EntityIdMap["notification"];

export type PushDeviceId = EntityIdMap["push_device"];

/** Post edit history ID - e.g., post_edit_01h455vb4pex5vsknk084sn02q */
export type PostEditId = EntityIdMap["post_edit"];

/** Comment edit history ID - e.g., post_comment_edit_01h455vb4pex5vsknk084sn02q */
export type PostCommentEditId = EntityIdMap["post_comment_edit"];

/** Post mention ID - e.g., post_mention_01h455vb4pex5vsknk084sn02q */
export type PostMentionId = EntityIdMap["post_mention"];

/** Internal staff note ID - e.g., post_note_01h455vb4pex5vsknk084sn02q */
export type PostNoteId = EntityIdMap["post_note"];

/** Segment ID - e.g., segment_01h455vb4pex5vsknk084sn02q */
export type SegmentId = EntityIdMap["segment"];

/** User attribute definition ID - e.g., user_attr_01h455vb4pex5vsknk084sn02q */
export type UserAttributeId = EntityIdMap["user_attr"];

/** User tag ID - e.g., user_tag_01h455vb4pex5vsknk084sn02q */
export type UserTagId = EntityIdMap["user_tag"];

/** Company attribute definition ID - e.g., company_attr_01h455vb4pex5vsknk084sn02q */
export type CompanyAttributeId = EntityIdMap["company_attr"];

/** Billing provider webhook event ID - e.g., billing_event_01h455vb4pex5vsknk084sn02q */
export type BillingEventId = EntityIdMap["billing_event"];

/** Billing usage ledger row ID - e.g., billing_usage_01h455vb4pex5vsknk084sn02q */
export type BillingUsageId = EntityIdMap["billing_usage"];

// RBAC
export type RoleId = EntityIdMap["role"];
export type PermissionId = EntityIdMap["permission"];
export type RolePermissionId = EntityIdMap["role_permission"];
export type RoleAssignmentId = EntityIdMap["role_assignment"];

// ============================================
// AI Entity IDs
// ============================================

/** Post sentiment analysis ID - e.g., sentiment_01h455vb4pex5vsknk084sn02q */
export type SentimentId = EntityIdMap["sentiment"];

/** AI usage log entry ID - e.g., ailog_01h455vb4pex5vsknk084sn02q */
export type AiUsageLogId = EntityIdMap["ai_usage"];

/** Email ledger row ID - e.g., emaillog_01h455vb4pex5vsknk084sn02q */
export type EmailLogId = EntityIdMap["email_log"];

/** Pipeline audit log entry ID - e.g., plog_01h455vb4pex5vsknk084sn02q */
export type PipelineLogId = EntityIdMap["pipeline_log"];

/** Post activity log ID - e.g., post_activity_01h455vb4pex5vsknk084sn02q */
export type PostActivityId = EntityIdMap["post_activity"];

/** Visitor analytics pageview ID - e.g., pv_01h455vb4pex5vsknk084sn02q */
export type PageViewId = EntityIdMap["page_view"];

/** Company (B2B customer account) ID - e.g., company_01h455vb4pex5vsknk084sn02q */
export type CompanyId = EntityIdMap["company"];

/** Assistant involvement ID - e.g., assistant_involvement_01h455vb4pex5vsknk084sn02q */
export type AssistantInvolvementId = EntityIdMap["assistant_involvement"];

/** Assistant guidance rule ID - e.g., assistant_guidance_01h455vb4pex5vsknk084sn02q */
export type AssistantGuidanceRuleId = EntityIdMap["assistant_guidance"];

/** Assistant pending action ID - e.g., assistant_action_01h455vb4pex5vsknk084sn02q */
export type AssistantPendingActionId = EntityIdMap["assistant_action"];

/** Remote MCP connector ID - e.g., connector_01h455vb4pex5vsknk084sn02q */
export type ConnectorId = EntityIdMap["connector"];

/** Agent skill (packaged procedure) ID - e.g., skill_01h455vb4pex5vsknk084sn02q */
export type SkillId = EntityIdMap["skill"];

/** Assistant tool-call audit ID - e.g., assistant_tool_call_01h455vb4pex5vsknk084sn02q */
export type AssistantToolCallId = EntityIdMap["assistant_tool_call"];

/** Assistant snippet ID - e.g., assistant_snippet_01h455vb4pex5vsknk084sn02q */
export type AssistantSnippetId = EntityIdMap["assistant_snippet"];

/** Assistant knowledge document ID - e.g., assistant_document_01h455vb4pex5vsknk084sn02q */
export type AssistantDocumentId = EntityIdMap["assistant_document"];

/** Uploaded file ID - e.g., file_01h455vb4pex5vsknk084sn02q */
export type FileId = EntityIdMap["file"];

/** Assistant web source ID - e.g., assistant_web_source_01h455vb4pex5vsknk084sn02q */
export type AssistantWebSourceId = EntityIdMap["assistant_web_source"];

/** Assistant usage-event ID - e.g., assistant_event_01h455vb4pex5vsknk084sn02q */
export type AssistantEventId = EntityIdMap["assistant_event"];

/** Ticket ID - e.g., ticket_01h455vb4pex5vsknk084sn02q */
export type TicketId = EntityIdMap["ticket"];

/** Ticket status ID - e.g., ticket_status_01h455vb4pex5vsknk084sn02q */
export type TicketStatusId = EntityIdMap["ticket_status"];

/** Ticket type (registry) ID - e.g., ticket_type_01h455vb4pex5vsknk084sn02q */
export type TicketTypeId = EntityIdMap["ticket_type"];

/** Ticket activity log ID - e.g., ticket_activity_01h455vb4pex5vsknk084sn02q */
export type TicketActivityId = EntityIdMap["ticket_activity"];

/** Ticket summary ID (Quinn ticket-resolution grounding) - e.g., ticket_summary_01h455vb4pex5vsknk084sn02q */
export type TicketSummaryId = EntityIdMap["ticket_summary"];

/** Ticket subscription (watcher) ID - e.g., ticket_sub_01h455vb4pex5vsknk084sn02q */
export type TicketSubscriptionId = EntityIdMap["ticket_sub"];

/** Channel account ID (§4.8) - e.g., channel_account_01h455vb4pex5vsknk084sn02q */
export type ChannelAccountId = EntityIdMap["channel_account"];

/** Channel thread correlation ID - e.g., channel_thread_01h455vb4pex5vsknk084sn02q */
export type ChannelThreadId = EntityIdMap["channel_thread"];

/** Sending domain ID (§4.8) - e.g., sending_domain_01h455vb4pex5vsknk084sn02q */
export type SendingDomainId = EntityIdMap["sending_domain"];

/** Office-hours schedule ID (§4.6) - e.g., office_hours_01h455vb4pex5vsknk084sn02q */
export type OfficeHoursId = EntityIdMap["office_hours"];

/** SLA policy ID (§4.6) - e.g., sla_policy_01h455vb4pex5vsknk084sn02q */
export type SlaPolicyId = EntityIdMap["sla_policy"];

/** SLA event ID (§4.6) - e.g., sla_event_01h455vb4pex5vsknk084sn02q */
export type SlaEventId = EntityIdMap["sla_event"];

/** Conversation attribute definition ID - e.g., conv_attr_01h455vb4pex5vsknk084sn02q */
export type ConversationAttributeId = EntityIdMap["conversation_attribute"];

/** Workflow ID (§4.6) - e.g., workflow_01h455vb4pex5vsknk084sn02q */
export type WorkflowId = EntityIdMap["workflow"];

/** Workflow run ID (§4.6) - e.g., workflow_run_01h455vb4pex5vsknk084sn02q */
export type WorkflowRunId = EntityIdMap["workflow_run"];

/** Workflow run-event ID (§4.6) - e.g., workflow_run_event_01h455vb4pex5vsknk084sn02q */
export type WorkflowRunEventId = EntityIdMap["workflow_run_event"];

/** Workflow version (history/rollback) ID (§4.6) - e.g., workflow_version_01h455vb4pex5vsknk084sn02q */
export type WorkflowVersionId = EntityIdMap["workflow_version"];

/** Team ID - e.g., team_01h455vb4pex5vsknk084sn02q */
export type TeamId = EntityIdMap["team"];

/** Team membership ID - e.g., team_member_01h455vb4pex5vsknk084sn02q */
export type TeamMemberId = EntityIdMap["team_member"];

/** Macro (canned reply with actions) ID - e.g., macro_01h455vb4pex5vsknk084sn02q */
export type MacroId = EntityIdMap["macro"];

/** Saved inbox view ID - e.g., conversation_view_01h455vb4pex5vsknk084sn02q */
export type ConversationViewId = EntityIdMap["conversation_view"];

/** Saved feedback-inbox view ID - e.g., post_view_01h455vb4pex5vsknk084sn02q */
export type PostViewId = EntityIdMap["post_view"];

// ============================================
// Feedback Aggregation Entity IDs
// ============================================

/** Feedback source ID - e.g., feedback_source_01h455vb4pex5vsknk084sn02q */
export type FeedbackSourceId = EntityIdMap["feedback_source"];

/** Raw feedback item ID - e.g., raw_feedback_01h455vb4pex5vsknk084sn02q */
export type RawFeedbackItemId = EntityIdMap["raw_feedback"];

/** Feedback signal ID - e.g., feedback_signal_01h455vb4pex5vsknk084sn02q */
export type FeedbackSignalId = EntityIdMap["feedback_signal"];

/** Feedback suggestion ID - e.g., feedback_suggestion_01h455vb4pex5vsknk084sn02q */
export type FeedbackSuggestionId = EntityIdMap["feedback_suggestion"];

/** External user mapping ID - e.g., user_mapping_01h455vb4pex5vsknk084sn02q */
export type ExternalUserMappingId = EntityIdMap["user_mapping"];

/** Merge suggestion ID - e.g., post_merge_sug_01h455vb4pex5vsknk084sn02q */
export type PostMergeSuggestionId = EntityIdMap["post_merge_suggestion"];

// ============================================
// Help Center Entity IDs
// ============================================

/** Help center category ID - e.g., kb_category_01h455vb4pex5vsknk084sn02q */
export type KbCategoryId = EntityIdMap["kb_category"];

/** Help center article ID - e.g., article_01h455vb4pex5vsknk084sn02q */
export type ArticleId = EntityIdMap["kb_article"];
/** @deprecated Prefer `ArticleId`. Same type; inbound `kb_article_…` is rewritten. */
export type KbArticleId = ArticleId;

/** Article feedback ID - e.g., kb_article_feedback_01h455vb4pex5vsknk084sn02q */
export type KbArticleFeedbackId = EntityIdMap["kb_article_feedback"];

/** Help center redirect rule ID - e.g., hc_redirect_rule_01h455vb4pex5vsknk084sn02q */
export type HcRedirectRuleId = EntityIdMap["hc_redirect_rule"];

/** Article translation ID - e.g., kb_article_translation_01h455vb4pex5vsknk084sn02q */
export type KbArticleTranslationId = EntityIdMap["kb_article_translation"];

/** Category translation ID - e.g., kb_category_translation_01h455vb4pex5vsknk084sn02q */
export type KbCategoryTranslationId = EntityIdMap["kb_category_translation"];

// ============================================
// Auth Entity IDs (Better-auth)
// ============================================

/** Workspace ID - e.g., workspace_01h455vb4pex5vsknk084sn02q */
export type WorkspaceId = EntityIdMap["workspace"];

/** User ID - e.g., user_01h455vb4pex5vsknk084sn02q */
export type UserId = EntityIdMap["user"];

/** Principal ID - e.g., principal_01h455vb4pex5vsknk084sn02q */
export type PrincipalId = EntityIdMap["principal"];

/** Session ID - e.g., session_01h455vb4pex5vsknk084sn02q */
export type SessionId = EntityIdMap["session"];

/** Account ID - e.g., account_01h455vb4pex5vsknk084sn02q */
export type AccountId = EntityIdMap["account"];

/** Invitation ID - e.g., invite_01h455vb4pex5vsknk084sn02q */
export type InviteId = EntityIdMap["invite"];

/** Verification ID - e.g., verification_01h455vb4pex5vsknk084sn02q */
export type VerificationId = EntityIdMap["verification"];

/** Domain ID - e.g., domain_01h455vb4pex5vsknk084sn02q */
export type DomainId = EntityIdMap["domain"];

/** Transfer token ID - e.g., transfer_token_01h455vb4pex5vsknk084sn02q */
export type TransferTokenId = EntityIdMap["transfer_token"];

/** Two-factor enrolment ID - e.g., two_factor_01h455vb4pex5vsknk084sn02q */
export type TwoFactorId = EntityIdMap["two_factor"];

/** Audit log entry ID - e.g., audit_01h455vb4pex5vsknk084sn02q */
export type AuditLogId = EntityIdMap["audit_log"];

/** SSO recovery code ID - e.g., rcode_01h455vb4pex5vsknk084sn02q */
export type SsoRecoveryCodeId = EntityIdMap["sso_recovery_code"];

/** Identity provider ID - e.g., idp_01h455vb4pex5vsknk084sn02q */
export type IdentityProviderId = EntityIdMap["identity_provider"];

/** API key ID - e.g., api_key_01h455vb4pex5vsknk084sn02q */
export type ApiKeyId = EntityIdMap["api_key"];

/** Webhook ID - e.g., webhook_01h455vb4pex5vsknk084sn02q */
export type WebhookId = EntityIdMap["webhook"];

// ============================================
// Eventing Entity IDs (durable event spine)
// ============================================

/** Domain event ID (events outbox row) - e.g., evt_01h455vb4pex5vsknk084sn02q */
export type EvtId = EntityIdMap["event"];

// ============================================
// Background job Entity IDs (Postgres queue)
// ============================================

/** Queued background job ID (job_queue row) - e.g., job_01h455vb4pex5vsknk084sn02q */
export type JobId = EntityIdMap["job"];

/** Third-party app ID (OAuth app platform) - e.g., app_01h455vb4pex5vsknk084sn02q */
export type AppId = EntityIdMap["app"];

// ============================================
// Type Utilities
// ============================================

/**
 * Extract the prefix from a TypeId type
 */
export type ExtractPrefix<T extends string> =
  T extends `${infer P}_${infer Rest}`
    ? Rest extends `${string}_${string}`
      ? `${P}_${ExtractPrefix<Rest>}`
      : P
    : never;

/**
 * Map from entity type to its TypeId type
 */
type EntityIds = {
  [E in EntityType]: TypeId<(typeof ID_PREFIXES)[E]>;
};

export interface EntityIdMap extends EntityIds {}

/**
 * Any TypeId (union of all entity ID types)
 */
export type AnyTypeId = EntityIdMap[keyof EntityIdMap];

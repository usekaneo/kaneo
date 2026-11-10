/**
 * TypeID prefix definitions for all entity types
 *
 * Convention: lowercase, singular nouns, descriptive but concise
 * Format: {prefix}_{base32_encoded_uuid}
 *
 * @example post_01h455vb4pex5vsknk084sn02q
 */
export const ID_PREFIXES = {
  // ============================================
  // Application Entities (UUID primary keys)
  // ============================================

  // Feedback domain
  post: "post",
  board: "board",
  post_comment: "post_comment",
  post_vote: "post_vote",
  post_tag: "post_tag",
  post_status: "post_status",
  post_comment_reaction: "post_comment_reaction",
  post_edit: "post_edit",
  post_comment_edit: "post_comment_edit",
  post_note: "post_note", // Internal staff notes on posts
  post_mention: "post_mention",
  post_view: "post_view",

  // Planning domain
  roadmap: "roadmap",
  roadmap_column: "roadmap_col",
  changelog: "changelog",
  changelog_category: "changelog_category",
  changelog_sub: "changelog_sub",

  // Status page
  status_component: "status_component",
  status_group: "status_group",
  status_incident: "status_incident",
  status_update: "status_update",
  status_sub: "status_sub",
  status_tmpl: "status_tmpl",

  // Conversations (support inbox)
  conversation: "conversation",
  conversation_message: "conversation_msg",
  conversation_tag: "conversation_tag",
  conversation_message_mention: "conversation_msg_mention",
  conversation_message_reaction: "conversation_msg_reaction",
  conversation_summary: "conversation_summary",
  conversation_message_translation: "conversation_msg_translation",
  // A stored upload attached to conversation and ticket messages.
  file: "file",

  // Help center
  kb_category: "kb_category",
  // Serialized as `article_…` (same UUID as the retired `kb_article_…` prefix).
  kb_article: "article",
  kb_article_feedback: "kb_article_feedback",
  hc_redirect_rule: "hc_redirect_rule",
  kb_article_translation: "kb_article_translation",
  kb_category_translation: "kb_category_translation",

  // Companies (B2B customer accounts)
  company: "company",

  // Teams (inbox assignment groups)
  team: "team",
  team_member: "team_member",

  // Inbox productivity
  macro: "macro",
  conversation_view: "conversation_view",
  conversation_attribute: "conv_attr",

  // Assistant (in-product AI agent)
  assistant_involvement: "assistant_involvement",
  assistant_guidance: "assistant_guidance",
  assistant_action: "assistant_action",
  // Remote MCP connector (Agent Connectors). Distinct from the retired REST
  // "data connectors" wave; the tool-name prefix `connector_<slug>__` is the
  // same proven grammar.
  connector: "connector",
  // Packaged agent procedure (name + when-to-use + markdown body).
  skill: "skill",
  assistant_tool_call: "assistant_tool_call",
  assistant_snippet: "assistant_snippet",
  assistant_document: "assistant_document",
  assistant_web_source: "assistant_web_source",
  assistant_event: "assistant_event",

  // Tickets (support platform §4.2)
  ticket: "ticket",
  ticket_status: "ticket_status",
  ticket_type: "ticket_type",
  ticket_activity: "ticket_activity",
  ticket_summary: "ticket_summary",
  ticket_sub: "ticket_sub",

  // Email channel (support platform §4.8)
  channel_account: "channel_account",
  channel_thread: "channel_thread",
  sending_domain: "sending_domain",

  // Workflows + SLA + office hours (support platform §4.6)
  office_hours: "office_hours",
  sla_policy: "sla_policy",
  sla_event: "sla_event",
  workflow: "workflow",
  workflow_run: "workflow_run",
  workflow_run_event: "workflow_run_event",
  workflow_version: "workflow_version",

  // Integrations
  integration: "integration",
  platform_cred: "platform_cred",
  event_mapping: "event_mapping",
  post_external_link: "post_external_link",
  ticket_external_link: "ticket_external_link",
  slack_monitor: "slack_monitor",

  // Imports & exports hub
  import_run: "import_run",
  export_run: "export_run",

  // Notifications
  post_subscription: "post_sub",
  notif_pref: "notif_pref",
  unsub_token: "unsub_token",
  notification: "notification",

  // Push devices (mobile agent app — APNs/FCM token registry)
  push_device: "push_device",

  // RBAC (roles + permissions)
  role: "role",
  permission: "perm",
  role_permission: "role_perm",
  role_assignment: "role_asgn",

  // Users
  segment: "segment",
  user_attr: "user_attr",
  company_attr: "company_attr",
  user_tag: "user_tag",

  // AI
  sentiment: "sentiment",
  ai_usage: "ailog",
  email_log: "emaillog",
  pipeline_log: "plog",

  // Feedback aggregation
  feedback_source: "feedback_source",
  raw_feedback: "raw_feedback",
  feedback_signal: "feedback_signal",
  feedback_suggestion: "feedback_suggestion",

  user_mapping: "user_mapping",
  post_merge_suggestion: "post_merge_sug",
  post_activity: "post_activity",

  // Visitor analytics
  page_view: "pv",

  // Billing (self-serve subscription for hosted workspaces; inert unless
  // a billing provider is configured)
  billing_event: "billing_event",
  billing_usage: "billing_usage",

  // ============================================
  // Auth Entities (Better-auth, text primary keys)
  // ============================================

  workspace: "workspace",
  user: "user",
  principal: "principal",
  session: "session",
  account: "account",
  invite: "invite",
  verification: "verification",
  domain: "domain",
  transfer_token: "transfer_token",
  two_factor: "two_factor",
  audit_log: "audit",
  sso_recovery_code: "rcode",
  identity_provider: "idp",

  // ============================================
  // API
  // ============================================

  api_key: "api_key",
  webhook: "webhook",

  // ============================================
  // Eventing (durable event spine)
  // ============================================

  event: "evt",

  // ============================================
  // Background jobs (Postgres queue)
  // ============================================

  job: "job",

  // ============================================
  // App platform (third-party OAuth apps)
  // ============================================

  app: "app",
} as const;

/**
 * Type representing any valid ID prefix
 */
export type IdPrefix = (typeof ID_PREFIXES)[keyof typeof ID_PREFIXES];

/**
 * Type representing entity type keys (for lookup)
 */
export type EntityType = keyof typeof ID_PREFIXES;

/**
 * Retired serialized prefixes that still identify the same entity.
 * Incoming IDs with these prefixes are accepted and rewritten to the
 * canonical `ID_PREFIXES` value by ensureTypeId and entity Zod schemas.
 */
export const ID_PREFIX_ALIASES: Readonly<Record<string, IdPrefix>> = {
  kb_article: "article",
  // Feedback entities, serialized under a `post_` namespace.
  status: "post_status",
  tag: "post_tag",
  comment: "post_comment",
  vote: "post_vote",
  reaction: "post_comment_reaction",
  comment_edit: "post_comment_edit",
  note: "post_note",
  activity: "post_activity",
  merge_sug: "post_merge_sug",
  linked_entity: "post_external_link",
  // Messenger entities, serialized under a `conversation_` namespace.
  chat_msg: "conversation_msg",
  chat_tag: "conversation_tag",
  chat_msg_mention: "conversation_msg_mention",
  // Help center entities, serialized under a `kb_` namespace.
  category: "kb_category",
  article_feedback: "kb_article_feedback",
};

/**
 * Get the prefix for a given entity type
 */
export function getPrefix(entity: EntityType): IdPrefix {
  return ID_PREFIXES[entity];
}

/**
 * Check if a string is a valid canonical prefix
 */
export function isValidPrefix(prefix: string): prefix is IdPrefix {
  return Object.values(ID_PREFIXES).includes(prefix as IdPrefix);
}

/**
 * True when `actual` is `expected` or a retired alias of it.
 */
export function prefixMatches(actual: string, expected: IdPrefix): boolean {
  return actual === expected || resolvePrefix(actual) === expected;
}

/**
 * Map a serialized prefix (canonical or alias) onto the catalogue prefix.
 */
export function resolvePrefix(prefix: string): IdPrefix | undefined {
  if (isValidPrefix(prefix)) return prefix;
  return Object.hasOwn(ID_PREFIX_ALIASES, prefix)
    ? ID_PREFIX_ALIASES[prefix]
    : undefined;
}

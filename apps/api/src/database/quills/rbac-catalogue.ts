/**
 * RBAC permission catalogue — the code-authoritative contract.
 *
 * Pure data, zero runtime deps, so the seed and the client both import it
 * without dragging in drizzle or the app. The `permissions` table rows are
 * seeded from this on deploy (for UI joins + `category` grouping); adding a
 * key is a TypeScript change plus a reconciling seed, never a schema migration.
 *
 * Keys are `noun.verb`; the UI grouping lives in the SEPARATE `category` field,
 * never the key prefix. Presets and the admin boundary are explicit permission
 * lists (never string-prefix filters), so adding a key can never silently widen
 * a role. Renaming or removing a key is breaking once a custom role or an API
 * consumer references it.
 *
 * A client-safe mirror lives at apps/web/src/lib/shared/permissions.ts and is
 * kept identical by a drift test.
 */

export const PERMISSIONS = {
  // category 'workspace' — workspace-level admin singletons (all in WORKSPACE_ADMIN_PERMISSIONS)
  SETTINGS_MANAGE: "settings.manage", // portal, widget, developer, general (branding + moderation split out in Phase 3)
  SETTINGS_BRANDING: "settings.branding", // theme, logos, custom CSS, workspace name
  SETTINGS_MODERATION: "settings.moderation", // workspace moderation default
  SETTINGS_NOTIFICATIONS: "settings.notifications", // RESERVED: no OSS surface yet
  SETTINGS_CUSTOM_DOMAIN: "settings.custom_domain", // Settings → Domains (cloud identity gateway)
  BILLING_MANAGE: "billing.manage", // cloud billing (Owner-only by default)
  ROLE_MANAGE: "role.manage", // create / edit custom roles
  API_KEY_MANAGE: "api_key.manage",
  WEBHOOK_VIEW: "webhook.view", // read outbound webhook subscriptions
  WEBHOOK_MANAGE: "webhook.manage", // create / edit / rotate webhook subscriptions + secrets
  AUTH_MANAGE: "auth.manage", // SSO / identity providers / 2FA policy
  AUDIT_VIEW: "audit.view",
  CUSTOM_FIELD_MANAGE: "custom_field.manage", // RESERVED: Custom Fields feature

  // category 'members' — teammates
  MEMBER_VIEW: "member.view", // read the teammate roster + assignee / owner pickers
  MEMBER_MANAGE: "member.manage", // invite / remove / change a teammate's roles

  // category 'people' — the People directory (end-users: visitor / lead / user)
  PEOPLE_VIEW: "people.view", // browse people + their lifecycle stage
  PEOPLE_MANAGE: "people.manage", // edit + the lead -> user merge

  // category 'company' — the Companies directory (the B2B companies object)
  COMPANY_VIEW: "company.view", // browse companies + plan / MRR context in the inbox
  COMPANY_MANAGE: "company.manage", // edit company records + person <-> company links

  // category 'audience' — targeting
  SEGMENT_VIEW: "segment.view",
  SEGMENT_MANAGE: "segment.manage",
  USER_ATTRIBUTE_VIEW: "user_attribute.view",
  USER_ATTRIBUTE_MANAGE: "user_attribute.manage",

  // category 'feedback'
  POST_VIEW_PRIVATE: "post.view_private", // internal / private posts
  POST_CREATE: "post.create",
  POST_EDIT: "post.edit", // edit title / content / lock comments
  POST_DELETE: "post.delete", // soft-delete + restore
  POST_SET_STATUS: "post.set_status", // move through the status pipeline
  POST_SET_BOARD: "post.set_board", // move to another board
  POST_SET_TAGS: "post.set_tags", // apply tags to a post
  POST_SET_OWNER: "post.set_owner", // assign owner / assignee
  POST_SET_AUTHOR: "post.set_author", // override author on create
  POST_MERGE: "post.merge", // merge / unmerge
  POST_EXPORT: "post.export", // bulk export (posts CSV)
  POST_SET_PINNED: "post.set_pinned", // RESERVED: pin a post to the top of its board
  POST_SET_ETA: "post.set_eta", // RESERVED: set a post ETA (time-based roadmap)
  POST_APPROVE: "post.approve", // approve / reject the pre-publication moderation queue
  POST_VOTE_ON_BEHALF: "post.vote_on_behalf",
  COMMENT_MODERATE: "comment.moderate", // edit / delete others' comments (narrows to restore + team-comment after Phase 3)
  COMMENT_EDIT: "comment.edit", // edit / delete others' comments
  COMMENT_PIN: "comment.pin", // pin / unpin a comment to a post
  COMMENT_VIEW_PRIVATE: "comment.view_private", // RESERVED: private comments feature
  BOARD_MANAGE: "board.manage", // create / edit / delete boards + access matrix
  ROADMAP_MANAGE: "roadmap.manage",
  STATUS_VIEW: "status.view", // read the post-status taxonomy (pickers)
  STATUS_MANAGE: "status.manage", // create / edit / reorder / delete post statuses
  TAG_VIEW: "tag.view", // read the tag taxonomy (pickers)
  TAG_MANAGE: "tag.manage", // create / edit / delete tag definitions
  SUGGESTION_VIEW: "suggestion.view", // read the AI feedback-suggestions triage queue
  SUGGESTION_MANAGE: "suggestion.manage", // accept / dismiss / restore / retry suggestions
  PRIORITIZATION_MANAGE: "prioritization.manage", // RESERVED: prioritization frameworks

  // category 'changelog'
  CHANGELOG_VIEW_DRAFT: "changelog.view_draft",
  CHANGELOG_MANAGE: "changelog.manage", // create / edit / publish / delete

  // category 'help_center'
  HELP_CENTER_MANAGE: "help_center.manage", // articles / categories

  // category 'survey' — RESERVED: Surveys feature
  SURVEY_VIEW: "survey.view", // RESERVED: view surveys + responses
  SURVEY_MANAGE: "survey.manage", // RESERVED: create / edit / delete surveys

  // category 'conversation' (the inbox)
  CONVERSATION_VIEW: "conversation.view", // your teams' inboxes (scoped by team membership)
  CONVERSATION_VIEW_ALL: "conversation.view_all", // cross-team supervisor scope override
  CONVERSATION_REPLY: "conversation.reply",
  CONVERSATION_NOTE: "conversation.note", // internal note
  CONVERSATION_ASSIGN: "conversation.assign",
  CONVERSATION_MANAGE: "conversation.manage", // delete, canned replies, capture email (status/tags split out in Phase 3)
  CONVERSATION_SET_STATUS: "conversation.set_status", // status / priority / end
  CONVERSATION_SET_TAGS: "conversation.set_tags", // apply tags to a conversation
  CONVERSATION_MANAGE_TAGS: "conversation.manage_tags", // define the chat-tag taxonomy
  CONVERSATION_MANAGE_VIEWS: "conversation.manage_views", // create / edit / delete shared saved inbox views
  CONVERSATION_SET_ATTRIBUTES: "conversation.set_attributes", // RESERVED: custom attributes feature

  // category 'analytics'
  ANALYTICS_VIEW: "analytics.view",

  // category 'integration'
  INTEGRATION_VIEW: "integration.view", // list connected integrations + in-inbox CRM lookups
  INTEGRATION_MANAGE: "integration.manage", // connect / configure / secrets

  // category 'support' — seeded, dormant until the support platform lands. Tickets are a PEER
  // aggregate (own lifecycle, need no conversation), so they carry their OWN resource verbs -- distinct
  // from the conversation.* set above. Scope is a dimension, not baked into the key: ticket.* is
  // TEAM-scoped for human members (via team membership + ticketFilter) and WORKSPACE-scoped for
  // machine / AI principals (principalType='service'), which hold ticket scopes directly and act on all
  // tickets in no team. View-scope stays a FILTER (no ticket.view_assigned key).
  TICKET_VIEW: "ticket.view", // read tickets (team-scoped for humans; all for machine/AI)
  TICKET_VIEW_ALL: "ticket.view_all", // cross-team supervisor override (mirrors conversation.view_all)
  TICKET_REPLY: "ticket.reply", // reply on customer-visible tickets
  TICKET_NOTE: "ticket.note", // internal note on a ticket
  TICKET_ASSIGN: "ticket.assign", // assign a ticket to a team / teammate
  TICKET_SET_STATUS: "ticket.set_status", // move a ticket through its lifecycle (per type)
  TICKET_CREATE: "ticket.create", // create a ticket without a conversation (peer-aggregate; AI / integration)
  TICKET_MANAGE_TYPES: "ticket.manage_types", // define ticket types + their statuses / fields
  SLA_MANAGE: "sla.manage", // manage SLA policies (workspace-admin)
  OFFICE_HOURS_MANAGE: "office_hours.manage", // manage business-hours schedules (workspace-admin)
  ROUTING_MANAGE: "routing.manage", // manage routing rules (workspace-admin)
  TEAM_MANAGE: "team.manage", // manage teams + membership (workspace-admin)
  WORKFLOW_MANAGE: "workflow.manage", // create / update / delete / status workflows (workspace-admin)
  CHANNEL_ACCOUNT_MANAGE: "channel_account.manage", // manage connected inbox channels (workspace-admin; was inbox.manage)

  // category 'ai'
  AI_CUSTOMER_MANAGE: "ai.customer.manage", // customer-facing AI (answers customers): identity, voice, knowledge, guidance, tools, who answers
  AI_TEAMMATE_MANAGE: "ai.teammate.manage", // teammate AI (Home chat, inbox assist, Slack): Copilot knowledge, capabilities, Slack agent
  COPILOT_USE: "copilot.use", // use the agent-facing Copilot assistant in the inbox

  // category 'status_page' — the Status page product (Status Product Spec §6).
  // Named status_page.* (not status.*) to avoid colliding with the existing
  // post-status-taxonomy keys above (STATUS_VIEW/STATUS_MANAGE).
  STATUS_PAGE_MANAGE: "status_page.manage", // components, groups, settings, templates (workspace-admin)
  STATUS_PAGE_PUBLISH: "status_page.publish", // create / update / resolve incidents and maintenance
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Every catalogue key as a flat array. The source of `owner` / `admin` bundles. */
export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as PermissionKey[];

/** Coarse grouping for the matrix UI; the `permissions.category` column value. */
export const PERMISSION_CATEGORIES = [
  "workspace",
  "members",
  "people",
  "company",
  "audience",
  "feedback",
  "changelog",
  "help_center",
  "survey",
  "conversation",
  "analytics",
  "integration",
  "support",
  "ai",
  "status_page",
] as const;

export type PermissionCategory = (typeof PERMISSION_CATEGORIES)[number];

/** Full per-key metadata: the seed reconciles `category` + `description` from this. */
export const PERMISSION_CATALOGUE: ReadonlyArray<{
  key: PermissionKey;
  category: PermissionCategory;
  description: string;
}> = [
  {
    key: PERMISSIONS.SETTINGS_MANAGE,
    category: "workspace",
    description:
      "Manage workspace settings: branding, general config, portal and widget, moderation default",
  },
  {
    key: PERMISSIONS.BILLING_MANAGE,
    category: "workspace",
    description: "Manage billing and subscription",
  },
  {
    key: PERMISSIONS.ROLE_MANAGE,
    category: "workspace",
    description: "Create and edit custom roles",
  },
  {
    key: PERMISSIONS.API_KEY_MANAGE,
    category: "workspace",
    description: "Create, rotate, and revoke API keys",
  },
  {
    key: PERMISSIONS.WEBHOOK_VIEW,
    category: "workspace",
    description: "View outbound webhook subscriptions",
  },
  {
    key: PERMISSIONS.WEBHOOK_MANAGE,
    category: "workspace",
    description: "Create, edit, and rotate webhook subscriptions and secrets",
  },
  {
    key: PERMISSIONS.AUTH_MANAGE,
    category: "workspace",
    description: "Manage SSO, identity providers, and the 2FA policy",
  },
  {
    key: PERMISSIONS.AUDIT_VIEW,
    category: "workspace",
    description: "View the audit log",
  },
  {
    key: PERMISSIONS.SETTINGS_BRANDING,
    category: "workspace",
    description:
      "Manage branding: theme, logos, custom CSS, and workspace name",
  },
  {
    key: PERMISSIONS.SETTINGS_MODERATION,
    category: "workspace",
    description: "Manage the workspace moderation default",
  },
  {
    key: PERMISSIONS.SETTINGS_NOTIFICATIONS,
    category: "workspace",
    description: "Manage notification settings (reserved; not yet enforced)",
  },
  {
    key: PERMISSIONS.SETTINGS_CUSTOM_DOMAIN,
    category: "workspace",
    description: "Manage the custom domain (reserved; not yet enforced)",
  },
  {
    key: PERMISSIONS.CUSTOM_FIELD_MANAGE,
    category: "workspace",
    description: "Define custom fields (reserved; not yet enforced)",
  },

  {
    key: PERMISSIONS.MEMBER_VIEW,
    category: "members",
    description: "View the teammate roster and assignee / owner pickers",
  },
  {
    key: PERMISSIONS.MEMBER_MANAGE,
    category: "members",
    description: "Invite, remove, and change a teammate's roles",
  },

  {
    key: PERMISSIONS.PEOPLE_VIEW,
    category: "people",
    description: "Browse people and their lifecycle stage",
  },
  {
    key: PERMISSIONS.PEOPLE_MANAGE,
    category: "people",
    description: "Edit people and merge a lead into an identified user",
  },

  {
    key: PERMISSIONS.COMPANY_VIEW,
    category: "company",
    description: "Browse companies and their plan / MRR context",
  },
  {
    key: PERMISSIONS.COMPANY_MANAGE,
    category: "company",
    description: "Edit company records and person-to-company links",
  },

  {
    key: PERMISSIONS.SEGMENT_VIEW,
    category: "audience",
    description: "View segments",
  },
  {
    key: PERMISSIONS.SEGMENT_MANAGE,
    category: "audience",
    description: "Create, edit, and delete segments",
  },
  {
    key: PERMISSIONS.USER_ATTRIBUTE_VIEW,
    category: "audience",
    description: "View user attribute definitions",
  },
  {
    key: PERMISSIONS.USER_ATTRIBUTE_MANAGE,
    category: "audience",
    description: "Create, edit, and delete user attribute definitions",
  },

  {
    key: PERMISSIONS.POST_VIEW_PRIVATE,
    category: "feedback",
    description: "View internal / private posts",
  },
  {
    key: PERMISSIONS.POST_CREATE,
    category: "feedback",
    description: "Create posts",
  },
  {
    key: PERMISSIONS.POST_EDIT,
    category: "feedback",
    description: "Edit a post title, content, and comment lock",
  },
  {
    key: PERMISSIONS.POST_DELETE,
    category: "feedback",
    description: "Delete and restore posts",
  },
  {
    key: PERMISSIONS.POST_SET_STATUS,
    category: "feedback",
    description: "Move a post through the status pipeline",
  },
  {
    key: PERMISSIONS.POST_SET_BOARD,
    category: "feedback",
    description: "Move a post to another board",
  },
  {
    key: PERMISSIONS.POST_SET_TAGS,
    category: "feedback",
    description: "Apply tags to a post",
  },
  {
    key: PERMISSIONS.POST_SET_OWNER,
    category: "feedback",
    description: "Assign a post owner",
  },
  {
    key: PERMISSIONS.POST_SET_AUTHOR,
    category: "feedback",
    description: "Override the author when creating a post",
  },
  {
    key: PERMISSIONS.POST_MERGE,
    category: "feedback",
    description: "Merge and unmerge posts",
  },
  {
    key: PERMISSIONS.POST_EXPORT,
    category: "feedback",
    description: "Bulk export posts",
  },
  {
    key: PERMISSIONS.POST_SET_PINNED,
    category: "feedback",
    description:
      "Pin a post to the top of its board (reserved; not yet enforced)",
  },
  {
    key: PERMISSIONS.POST_SET_ETA,
    category: "feedback",
    description:
      "Set a post ETA for time-based roadmaps (reserved; not yet enforced)",
  },
  {
    key: PERMISSIONS.POST_APPROVE,
    category: "feedback",
    description: "Approve or reject the pre-publication moderation queue",
  },
  {
    key: PERMISSIONS.POST_VOTE_ON_BEHALF,
    category: "feedback",
    description: "Cast votes on behalf of another person",
  },
  {
    key: PERMISSIONS.COMMENT_MODERATE,
    category: "feedback",
    description: "Edit and delete others' comments",
  },
  {
    key: PERMISSIONS.COMMENT_EDIT,
    category: "feedback",
    description: "Edit and delete others' comments",
  },
  {
    key: PERMISSIONS.COMMENT_PIN,
    category: "feedback",
    description: "Pin and unpin a comment to a post",
  },
  {
    key: PERMISSIONS.COMMENT_VIEW_PRIVATE,
    category: "feedback",
    description: "View private comments (reserved; not yet enforced)",
  },
  {
    key: PERMISSIONS.BOARD_MANAGE,
    category: "feedback",
    description: "Create, edit, and delete boards and the board access matrix",
  },
  {
    key: PERMISSIONS.ROADMAP_MANAGE,
    category: "feedback",
    description: "Create, edit, and delete roadmaps",
  },
  {
    key: PERMISSIONS.STATUS_VIEW,
    category: "feedback",
    description: "Read the post-status taxonomy (pickers)",
  },
  {
    key: PERMISSIONS.STATUS_MANAGE,
    category: "feedback",
    description: "Create, edit, reorder, and delete post statuses",
  },
  {
    key: PERMISSIONS.TAG_VIEW,
    category: "feedback",
    description: "Read the tag taxonomy (pickers)",
  },
  {
    key: PERMISSIONS.TAG_MANAGE,
    category: "feedback",
    description: "Create, edit, and delete tag definitions",
  },
  {
    key: PERMISSIONS.SUGGESTION_VIEW,
    category: "feedback",
    description: "Read the AI feedback-suggestions triage queue",
  },
  {
    key: PERMISSIONS.SUGGESTION_MANAGE,
    category: "feedback",
    description: "Accept, dismiss, restore, and retry feedback suggestions",
  },
  {
    key: PERMISSIONS.PRIORITIZATION_MANAGE,
    category: "feedback",
    description:
      "Manage prioritization frameworks (reserved; not yet enforced)",
  },

  {
    key: PERMISSIONS.CHANGELOG_VIEW_DRAFT,
    category: "changelog",
    description: "View draft changelog entries",
  },
  {
    key: PERMISSIONS.CHANGELOG_MANAGE,
    category: "changelog",
    description: "Create, edit, publish, and delete changelog entries",
  },

  {
    key: PERMISSIONS.HELP_CENTER_MANAGE,
    category: "help_center",
    description: "Manage help center articles and categories",
  },

  {
    key: PERMISSIONS.SURVEY_VIEW,
    category: "survey",
    description: "View surveys and responses (reserved; not yet enforced)",
  },
  {
    key: PERMISSIONS.SURVEY_MANAGE,
    category: "survey",
    description:
      "Create, edit, and delete surveys (reserved; not yet enforced)",
  },

  {
    key: PERMISSIONS.CONVERSATION_VIEW,
    category: "conversation",
    description: "View conversations in the inbox",
  },
  {
    key: PERMISSIONS.CONVERSATION_VIEW_ALL,
    category: "conversation",
    description: "View all teams' conversations (cross-team supervisor scope)",
  },
  {
    key: PERMISSIONS.CONVERSATION_REPLY,
    category: "conversation",
    description: "Reply to conversations",
  },
  {
    key: PERMISSIONS.CONVERSATION_NOTE,
    category: "conversation",
    description: "Add internal notes to conversations",
  },
  {
    key: PERMISSIONS.CONVERSATION_ASSIGN,
    category: "conversation",
    description: "Assign conversations",
  },
  {
    key: PERMISSIONS.CONVERSATION_MANAGE,
    category: "conversation",
    description:
      "Manage conversation status, tags, canned replies, and deletion",
  },
  {
    key: PERMISSIONS.CONVERSATION_SET_STATUS,
    category: "conversation",
    description: "Set conversation status, priority, and end state",
  },
  {
    key: PERMISSIONS.CONVERSATION_SET_TAGS,
    category: "conversation",
    description: "Apply tags to a conversation",
  },
  {
    key: PERMISSIONS.CONVERSATION_MANAGE_TAGS,
    category: "conversation",
    description: "Define the conversation tag taxonomy",
  },
  {
    key: PERMISSIONS.CONVERSATION_MANAGE_VIEWS,
    category: "conversation",
    description: "Create, edit, and delete shared saved inbox views",
  },
  {
    key: PERMISSIONS.CONVERSATION_SET_ATTRIBUTES,
    category: "conversation",
    description:
      "Set conversation custom attributes (reserved; not yet enforced)",
  },

  {
    key: PERMISSIONS.ANALYTICS_VIEW,
    category: "analytics",
    description: "View analytics",
  },

  {
    key: PERMISSIONS.INTEGRATION_VIEW,
    category: "integration",
    description: "List connected integrations and run in-inbox CRM lookups",
  },
  {
    key: PERMISSIONS.INTEGRATION_MANAGE,
    category: "integration",
    description: "Connect, configure, and manage integration secrets",
  },

  {
    key: PERMISSIONS.TICKET_VIEW,
    category: "support",
    description:
      "View tickets (team-scoped for humans; all tickets for machine / AI principals)",
  },
  {
    key: PERMISSIONS.TICKET_VIEW_ALL,
    category: "support",
    description: "View all teams' tickets (cross-team supervisor override)",
  },
  {
    key: PERMISSIONS.TICKET_REPLY,
    category: "support",
    description: "Reply on customer-visible tickets",
  },
  {
    key: PERMISSIONS.TICKET_NOTE,
    category: "support",
    description: "Add internal notes to tickets",
  },
  {
    key: PERMISSIONS.TICKET_ASSIGN,
    category: "support",
    description: "Assign a ticket to a team or teammate",
  },
  {
    key: PERMISSIONS.TICKET_SET_STATUS,
    category: "support",
    description: "Move a ticket through its lifecycle",
  },
  {
    key: PERMISSIONS.TICKET_CREATE,
    category: "support",
    description: "Create a ticket without a conversation",
  },
  {
    key: PERMISSIONS.TICKET_MANAGE_TYPES,
    category: "support",
    description: "Define ticket types and their statuses and fields",
  },
  {
    key: PERMISSIONS.SLA_MANAGE,
    category: "support",
    description: "Manage SLA policies",
  },
  {
    key: PERMISSIONS.OFFICE_HOURS_MANAGE,
    category: "support",
    description: "Manage business-hours schedules",
  },
  {
    key: PERMISSIONS.ROUTING_MANAGE,
    category: "support",
    description: "Manage routing rules",
  },
  {
    key: PERMISSIONS.TEAM_MANAGE,
    category: "support",
    description: "Manage teams and membership",
  },
  {
    key: PERMISSIONS.WORKFLOW_MANAGE,
    category: "support",
    description: "Manage workflows and automation",
  },
  {
    key: PERMISSIONS.CHANNEL_ACCOUNT_MANAGE,
    category: "support",
    description: "Manage connected inbox channels (email / widget accounts)",
  },

  {
    key: PERMISSIONS.AI_CUSTOMER_MANAGE,
    category: "ai",
    description:
      "Manage the customer-facing AI: identity, voice, knowledge, guidance, and tools",
  },
  {
    key: PERMISSIONS.AI_TEAMMATE_MANAGE,
    category: "ai",
    description:
      "Manage the teammate AI: Copilot knowledge and capabilities, and the Slack agent",
  },
  {
    key: PERMISSIONS.COPILOT_USE,
    category: "ai",
    description: "Use the agent-facing Copilot assistant in the inbox",
  },

  {
    key: PERMISSIONS.STATUS_PAGE_MANAGE,
    category: "status_page",
    description:
      "Manage status page components, groups, settings, and templates",
  },
  {
    key: PERMISSIONS.STATUS_PAGE_PUBLISH,
    category: "status_page",
    description:
      "Create, update, and resolve status incidents and maintenance windows",
  },
];

// --------------------------------------------------------------- presets ---

export const SYSTEM_ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  MANAGER: "manager",
  SUPPORT_LEAD: "support_lead",
  CONTRIBUTOR: "contributor",
} as const;

export type SystemRoleKey = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

/**
 * The workspace-admin permissions: Owner + Admin only, and the boundary that
 * defines Manager ("everything except these"). An explicit list, NOT a string
 * prefix or a category, so adding a permission can never silently widen Manager.
 * member.manage and integration.manage live here even though their UI categories
 * pair them with their .view siblings.
 */
export const WORKSPACE_ADMIN_PERMISSIONS: readonly PermissionKey[] = [
  PERMISSIONS.SETTINGS_MANAGE,
  PERMISSIONS.SETTINGS_BRANDING,
  PERMISSIONS.SETTINGS_MODERATION,
  PERMISSIONS.SETTINGS_NOTIFICATIONS,
  PERMISSIONS.SETTINGS_CUSTOM_DOMAIN,
  PERMISSIONS.BILLING_MANAGE,
  PERMISSIONS.MEMBER_MANAGE,
  PERMISSIONS.ROLE_MANAGE,
  PERMISSIONS.API_KEY_MANAGE,
  PERMISSIONS.WEBHOOK_VIEW,
  PERMISSIONS.WEBHOOK_MANAGE,
  PERMISSIONS.AUTH_MANAGE,
  PERMISSIONS.INTEGRATION_MANAGE,
  PERMISSIONS.AUDIT_VIEW,
  PERMISSIONS.CUSTOM_FIELD_MANAGE, // defining custom fields is an admin-class schema action
  // support infrastructure config: SLA policies, office hours, routing rules, teams, inbox
  // channels (admin-only)
  PERMISSIONS.SLA_MANAGE,
  PERMISSIONS.OFFICE_HOURS_MANAGE,
  PERMISSIONS.ROUTING_MANAGE,
  PERMISSIONS.TEAM_MANAGE,
  PERMISSIONS.WORKFLOW_MANAGE,
  PERMISSIONS.CHANNEL_ACCOUNT_MANAGE,
  // AI infrastructure config (admin-only)
  PERMISSIONS.AI_CUSTOMER_MANAGE,
  PERMISSIONS.AI_TEAMMATE_MANAGE,
  // Status page structure (components/groups/settings/templates) is
  // admin-only; publishing incidents is a broader operator action (below).
  PERMISSIONS.STATUS_PAGE_MANAGE,
];

/**
 * The support-operations permissions a Support lead holds on top of everything
 * Manager has: routing, workflows, SLA policies, office hours, inbox channels,
 * custom fields, and the customer-facing AI. An explicit list so a new
 * workspace-admin permission never reaches the preset by accident. Teams,
 * settings, integrations, and the teammate AI stay admin-only.
 */
export const SUPPORT_LEAD_EXTRA_PERMISSIONS: readonly PermissionKey[] = [
  PERMISSIONS.ROUTING_MANAGE,
  PERMISSIONS.WORKFLOW_MANAGE,
  PERMISSIONS.SLA_MANAGE,
  PERMISSIONS.OFFICE_HOURS_MANAGE,
  PERMISSIONS.CHANNEL_ACCOUNT_MANAGE,
  PERMISSIONS.CUSTOM_FIELD_MANAGE,
  PERMISSIONS.AI_CUSTOMER_MANAGE,
];

/**
 * Permission keys retired from the catalogue. Their `permissions` rows and
 * grants stay in the database so an older app version still running during a
 * rollout keeps working; the reconcile leaves their preset grants alone.
 */
export const RETIRED_PERMISSION_KEYS: readonly string[] = ["assistant.manage"];

export const SYSTEM_ROLE_PERMISSIONS: Record<SystemRoleKey, PermissionKey[]> = {
  owner: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS.filter((p) => p !== PERMISSIONS.BILLING_MANAGE),
  // Everything except the workspace-admin set; this naturally keeps member.view +
  // integration.view (not in the set) while excluding member.manage / integration.manage.
  manager: ALL_PERMISSIONS.filter(
    (p) => !WORKSPACE_ADMIN_PERMISSIONS.includes(p),
  ),
  // Manager plus the support-operations configuration permissions.
  support_lead: ALL_PERMISSIONS.filter(
    (p) =>
      !WORKSPACE_ADMIN_PERMISSIONS.includes(p) ||
      SUPPORT_LEAD_EXTRA_PERMISSIONS.includes(p),
  ),
  // Broad cross-domain operator: works feedback + (later) support queues; does not
  // configure product structure or settings. The support operate permissions are
  // appended here by default when the platform lands.
  contributor: [
    // sort feedback: triage without destructive edit
    PERMISSIONS.POST_VIEW_PRIVATE,
    PERMISSIONS.POST_CREATE,
    PERMISSIONS.POST_SET_STATUS,
    PERMISSIONS.POST_SET_BOARD,
    PERMISSIONS.POST_SET_TAGS,
    PERMISSIONS.POST_SET_OWNER,
    PERMISSIONS.POST_MERGE,
    PERMISSIONS.POST_APPROVE,
    PERMISSIONS.POST_VOTE_ON_BEHALF,
    // comments
    PERMISSIONS.COMMENT_MODERATE,
    PERMISSIONS.COMMENT_PIN,
    // inbox
    PERMISSIONS.CONVERSATION_VIEW,
    PERMISSIONS.CONVERSATION_REPLY,
    PERMISSIONS.CONVERSATION_NOTE,
    PERMISSIONS.CONVERSATION_ASSIGN,
    PERMISSIONS.CONVERSATION_SET_STATUS,
    PERMISSIONS.CONVERSATION_SET_TAGS,
    PERMISSIONS.COPILOT_USE,
    // reads + triage intake
    PERMISSIONS.CHANGELOG_VIEW_DRAFT,
    PERMISSIONS.PEOPLE_VIEW,
    PERMISSIONS.COMPANY_VIEW,
    PERMISSIONS.MEMBER_VIEW,
    PERMISSIONS.SEGMENT_VIEW,
    PERMISSIONS.INTEGRATION_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.STATUS_VIEW,
    PERMISSIONS.TAG_VIEW,
    PERMISSIONS.SUGGESTION_VIEW,
    PERMISSIONS.SUGGESTION_MANAGE,
    // on-call responders post incident/maintenance updates; only admins
    // reshape the page (status_page.manage, above)
    PERMISSIONS.STATUS_PAGE_PUBLISH,
    // deliberately NOT granted (destructive / identity / config): post.edit, post.delete,
    // post.set_author, comment.edit, conversation.manage_tags, conversation.manage
  ],
};

/** Seed metadata for the four `is_system` roles (name + description columns). */
export const SYSTEM_ROLE_DEFS: ReadonlyArray<{
  key: SystemRoleKey;
  name: string;
  description: string;
}> = [
  {
    key: SYSTEM_ROLES.OWNER,
    name: "Owner",
    description: "Full access, including billing and role management",
  },
  {
    key: SYSTEM_ROLES.ADMIN,
    name: "Admin",
    description: "Full access except billing",
  },
  {
    key: SYSTEM_ROLES.MANAGER,
    name: "Manager",
    description:
      "Configures and operates the whole product and inbox; no workspace-admin permissions",
  },
  {
    key: SYSTEM_ROLES.SUPPORT_LEAD,
    name: "Support lead",
    description:
      "Everything a Manager can do, plus routing, workflows, SLA policies, office hours, inbox channels, custom fields, and the customer-facing AI",
  },
  {
    key: SYSTEM_ROLES.CONTRIBUTOR,
    name: "Contributor",
    description:
      "Cross-domain operator: works feedback and support queues; does not configure product structure or settings",
  },
];

/**
 * Legacy `principal.role` -> system role preset. The non-regressing backfill
 * mapping: admin -> Owner, member -> Manager, user -> no assignment (People axis).
 */
export function presetForLegacyRole(role: string): SystemRoleKey | null {
  if (role === "admin") return SYSTEM_ROLES.OWNER;
  if (role === "member") return SYSTEM_ROLES.MANAGER;
  return null;
}

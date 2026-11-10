import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  BoardId,
  PostStatusId,
  PostTagId,
  SegmentId,
  TicketId,
} from "@kaneo/ids";
import type {
  boards,
  roadmaps,
  roadmapColumns,
  postTags,
} from "./schema/boards";
import type { postStatuses } from "./schema/statuses";
import type {
  posts,
  postTagAssignments,
  postVotes,
  postComments,
  postCommentReactions,
  postNotes,
} from "./schema/posts";
import type { integrations } from "./schema/integrations";
import type { changelogEntries, changelogEntryPosts } from "./schema/changelog";
import type {
  conversations,
  conversationMessages,
  conversationTags,
  conversationMessageMentions,
  conversationMessageReactions,
  conversationMessageFlags,
  conversationMessageTranslations,
} from "./schema/conversation";
import type { teams, teamMembers } from "./schema/teams";
import type {
  tickets,
  ticketStatuses,
  ticketConversations,
  ticketLinks,
} from "./schema/tickets";
import type { ticketTypes } from "./schema/ticket-types";
import type { ticketActivity } from "./schema/ticket-activity";
import type { principal } from "./schema/auth";
import type { workspaceExperiments } from "./schema/labs";

export type {
  IdentitySource,
  ProfileField,
  ClaimRoleMapping,
  ClaimRoleRule,
  IdentityProviderClaimMapping,
  SourceSnapshot,
  SourceUnavailableReason,
  CapturedIdentity,
  IdentityProviderTestCapture,
  IdentityProviderTestCaptureV1,
  IdentityProviderTestCaptureV2,
} from "./schema/auth";

// Status categories (defined here to avoid circular imports in tests)
export const STATUS_CATEGORIES = ["active", "complete", "closed"] as const;
export type StatusCategory = (typeof STATUS_CATEGORIES)[number];

export const ROADMAP_TYPES = ["column", "date"] as const;
export type RoadmapType = (typeof ROADMAP_TYPES)[number];

export const ROADMAP_DATE_SOURCES = ["eta"] as const;
export type RoadmapDateSource = (typeof ROADMAP_DATE_SOURCES)[number];

export const ROADMAP_FREQUENCIES = [
  "monthly",
  "quarterly",
  "semiannual",
] as const;
export type RoadmapFrequency = (typeof ROADMAP_FREQUENCIES)[number];

export const ROADMAP_VISIBILITIES = ["public", "team", "segment"] as const;
export type RoadmapVisibility = (typeof ROADMAP_VISIBILITIES)[number];

export interface RoadmapBaseFilter {
  statusIds?: PostStatusId[];
  boardIds?: BoardId[];
  tagIds?: PostTagId[];
  segmentIds?: SegmentId[];
}

// Moderation states for posts — single source of truth, kept in sync with
// the posts.moderation_state column enum (schema.test.ts pins the match).
export const MODERATION_STATES = [
  "published",
  "pending",
  "spam",
  "archived",
  "closed",
  "deleted",
] as const;
export type ModerationState = (typeof MODERATION_STATES)[number];

// Board types
export type Board = InferSelectModel<typeof boards>;
export type NewBoard = InferInsertModel<typeof boards>;

// Board settings (stored in boards.settings JSONB column)
export interface BoardSettings {
  roadmapStatusIds?: PostStatusId[]; // Status IDs to show on roadmap
  customFields?: BoardCustomField[]; // Extra intake fields the submission form renders
}

/** The input controls a board custom field can render as on the public
 *  submission form. Mirrors the ticket intake-form field types. */
export const BOARD_CUSTOM_FIELD_TYPES = [
  "text",
  "long_text",
  "number",
  "select",
  "date",
  "checkbox",
] as const;
export type BoardCustomFieldType = (typeof BOARD_CUSTOM_FIELD_TYPES)[number];

/**
 * One configurable field on a board's public submission form. Validated
 * values land in the post's `customFieldValues` JSONB column, keyed by
 * `key`. `options` is only meaningful for `select`.
 */
export interface BoardCustomField {
  key: string;
  label: string;
  type: BoardCustomFieldType;
  required: boolean;
  options?: string[];
}

/** Validated custom-field answers as stored on a post row. Every field type
 *  coerces to a JSON scalar, so the map is always wire-serializable. */
export type CustomFieldValues = Record<string, string | number | boolean>;

// ----------------------------------------------------------------------
// Per-action access tiers (View+Vote / Comment / Submit) and per-board
// approval overrides. The legacy `BoardAudience` discriminated union was
// removed in migration 0080 — every reader now consults `BoardAccess`.
// ----------------------------------------------------------------------

export const ACCESS_TIERS = [
  "anonymous",
  "authenticated",
  "segments",
  "team",
] as const;
export type AccessTier = (typeof ACCESS_TIERS)[number];

/** Restriction rank — higher number is stricter. Used for tier-invariant
 *  checks: a derived action (comment / submit) cannot be more permissive
 *  than view. */
export const ACCESS_TIER_RANK: Record<AccessTier, number> = {
  anonymous: 0,
  authenticated: 1,
  segments: 2,
  team: 3,
};

/** Per-board moderation rule values. A board can either:
 *   - `inherit`: resolve from the workspace's portalConfig.moderationDefault.requireApproval
 *   - `on`:      force-hold matching submissions for review (override on)
 *   - `off`:     force-allow matching submissions without review (override off)
 *  The three axes (anonPosts / signedPosts / comments) match the design's
 *  Moderation tab and the workspace requireApproval shape. */
export const MODERATION_RULE_VALUES = ["inherit", "on", "off"] as const;
export type ModerationRuleValue = (typeof MODERATION_RULE_VALUES)[number];

/** Who may reply on a board's threads, on top of the `comment` tier.
 *   - `anyone`      — today's behaviour: the comment tier alone decides.
 *   - `author-only` — only each post's own author and the team may reply.
 *  Everyone the view tier admits still reads every thread in full — each
 *  thread stays a publicly readable conversation between its author and
 *  the team. */
export const REPLY_POLICIES = ["anyone", "author-only"] as const;
export type ReplyPolicy = (typeof REPLY_POLICIES)[number];

export interface BoardAccess {
  view: AccessTier;
  vote: AccessTier;
  comment: AccessTier;
  submit: AccessTier;
  /** Per-action segment allowlists — used wherever the matching tier is
   *  'segments'. A board can say "Active Users can view & comment, but
   *  only Beta testers can submit." Invalid (and rejected on save) when
   *  an action's tier is 'segments' but that action's list is empty. */
  segments: {
    view: string[];
    vote: string[];
    comment: string[];
    submit: string[];
  };
  /** Tri-state per-board moderation overrides for posts (split by author
   *  type) and comments. `inherit` defers to the workspace default; `on`
   *  and `off` are explicit per-board overrides. */
  moderation: {
    anonPosts: ModerationRuleValue;
    signedPosts: ModerationRuleValue;
    comments: ModerationRuleValue;
  };
  /** Optional reply restriction (see {@link REPLY_POLICIES}). Absent means
   *  `'anyone'` — read it through {@link resolveReplyPolicy}, never directly.
   *  Deliberately optional and ABSENT from {@link DEFAULT_BOARD_ACCESS}: the
   *  column default is byte-pinned to its migration literal, so keeping the
   *  key out of the default is what lets this ship without a migration. */
  replyPolicy?: ReplyPolicy;
}

// Key order is jsonb-canonical (length, then bytewise) so the serialized
// column default matches what postgres stores for the migration's default;
// the drift check compares the two strings byte for byte.
export const DEFAULT_BOARD_ACCESS: BoardAccess = {
  view: "anonymous",
  vote: "anonymous",
  submit: "anonymous",
  comment: "anonymous",
  segments: { view: [], vote: [], submit: [], comment: [] },
  moderation: {
    comments: "inherit",
    anonPosts: "inherit",
    signedPosts: "inherit",
  },
};

// Integration config (stored in integrations.config JSONB column)
// Each integration defines its own typed config at the integration layer.
export type IntegrationConfig = Record<string, unknown>;

// Event mapping config (stored in event_mappings JSONB columns)
export interface EventMappingActionConfig {
  templateId?: string;
  message?: string;
  [key: string]: string | boolean | number | undefined;
}

export interface EventMappingFilters {
  boardIds?: string[];
  statusIds?: string[];
  [key: string]: string[] | string | boolean | number | undefined;
}

// TipTap rich text content (stored in contentJson JSONB columns)
export interface TiptapContent {
  type: string;
  content?: TiptapContent[];
  text?: string;
  marks?: {
    type: string;
    attrs?: Record<string, string | number | boolean | null>;
  }[];
  attrs?: Record<string, string | number | boolean | null>;
}

// Raw feedback JSONB column types
export interface RawFeedbackAuthor {
  name?: string;
  email?: string;
  externalUserId?: string;
  principalId?: string;
  attributes?: Record<string, unknown>;
}

export interface RawFeedbackContent {
  subject?: string;
  text: string;
  html?: string;
  language?: string;
}

export interface RawFeedbackThreadMessage {
  id: string;
  authorName?: string;
  authorEmail?: string;
  role?: "customer" | "agent" | "teammate" | "system";
  sentAt: string;
  text: string;
  isTrigger?: boolean;
}

export interface RawFeedbackItemContextEnvelope {
  sourceChannel?: {
    id?: string;
    name?: string;
    type?: string;
    purpose?: string;
    permalink?: string;
  };
  sourceTicket?: {
    id?: string;
    status?: string;
    priority?: string;
    tags?: string[];
    customFields?: Record<string, unknown>;
  };
  sourceConversation?: {
    id?: string;
    state?: string;
    tags?: string[];
  };
  thread?: RawFeedbackThreadMessage[];
  customer?: {
    id?: string;
    email?: string;
    company?: string;
    plan?: string;
    mrr?: number;
    attributes?: Record<string, unknown>;
  };
  pageContext?: {
    url?: string;
    title?: string;
    route?: string;
    userAgent?: string;
    sessionId?: string;
  };
  attachments?: Array<{
    id?: string;
    name: string;
    mimeType?: string;
    sizeBytes?: number;
    url?: string;
  }>;
  metadata?: Record<string, unknown>;
}

// Use case types for personalized onboarding
/**
 * First-run intent — ideally an *outcome* ICP would name, not an industry
 * vertical.
 *
 * UI offers: product_feedback | customer_support | help_center | internal.
 * Legacy saas | consumer | marketplace still parse (config-file / old rows)
 * and collapse onto an outcome via normalizeOnboardingOutcome (apps/web
 * shared db-types).
 */
export const USE_CASE_TYPES = [
  "product_feedback",
  "customer_support",
  "help_center",
  "status_page",
  "internal",
  // Legacy — do not show in the picker
  "saas",
  "consumer",
  "marketplace",
] as const;
export type UseCaseType = (typeof USE_CASE_TYPES)[number];

/** Outcomes shown in the onboarding picker (stable subset of UseCaseType). */
export const ONBOARDING_OUTCOMES = [
  "product_feedback",
  "customer_support",
  "help_center",
  "status_page",
  "internal",
] as const;
export type OnboardingOutcome = (typeof ONBOARDING_OUTCOMES)[number];

// Setup state for tracking onboarding/provisioning (stored in settings.setup_state).
// V2 deliberately separates completing the short setup wizard from reaching an
// activation win. A deferred starting point completes setup, but never counts as
// a completed launch task.
export const STARTING_POINT_RESOURCE_TYPES = [
  "board",
  "messenger",
  "article",
  "none",
] as const;
export type StartingPointResourceType =
  (typeof STARTING_POINT_RESOURCE_TYPES)[number];

export const STARTING_POINT_SOURCES = [
  "wizard",
  "managed",
  "existing",
] as const;
export type StartingPointSource = (typeof STARTING_POINT_SOURCES)[number];

export const STARTING_POINT_RESOLUTIONS = [
  "created",
  "configured",
  "deferred",
  "unavailable",
] as const;
export type StartingPointResolution =
  (typeof STARTING_POINT_RESOLUTIONS)[number];

export interface StartingPointState {
  outcome: OnboardingOutcome;
  resourceType: StartingPointResourceType;
  resourceId?: string;
  source: StartingPointSource;
  resolution: StartingPointResolution;
  completedAt: string;
}

export type LaunchTaskResolutionKind = "deferred" | "dismissed";
export interface LaunchTaskResolution {
  resolution: LaunchTaskResolutionKind;
  resolvedAt: string;
}
export type OutcomeTaskResolutions = Partial<
  Record<OnboardingOutcome, Record<string, LaunchTaskResolution>>
>;

export interface ActivationMilestones {
  /** A workspace admin copied a publicly viewable board's distribution link. */
  publicBoardLinkCopiedAt?: string;
  /** A workspace admin copied the status page link. */
  statusLinkCopiedAt?: string;
}

export type SetupCompletionSource = "wizard" | "managed" | "legacy";

export interface SetupState {
  version: 2;
  steps: {
    core: boolean;
    workspace: boolean;
    startingPoint: StartingPointState | null;
  };
  completedAt?: string;
  /**
   * The principal who set the workspace up. Recorded once and never moved, so
   * the owner stays the owner whatever role they hold later.
   */
  ownerPrincipalId?: string;
  /** ICP outcome for setup and activation personalization. */
  useCase?: OnboardingOutcome;
  /** Ordered products selected during setup; the first is the activation goal. */
  goals?: OnboardingOutcome[];
  feedbackPrivate?: boolean;
  /** Cloud owner saved or skipped the optional post-handoff identity polish. */
  workspaceDetailsSeenAt?: string;
  completionSource?: SetupCompletionSource;
  /** Set only after the one-time setup-to-activation bridge has been acknowledged. */
  activationHandoffSeenAt?: string;
  /** Required tasks may be deferred; optional polish alone may be dismissed. */
  taskResolutions?: OutcomeTaskResolutions;
  /** Product-led activation signals that are not durable domain artifacts. */
  activationMilestones?: ActivationMilestones;
}

export const DEFAULT_SETUP_STATE: SetupState = {
  version: 2,
  steps: {
    core: true,
    workspace: false,
    startingPoint: null,
  },
};

const LEGACY_POLISH_TASK_IDS = new Set([
  "customize-branding",
  "status-component",
  "connect-integration",
]);
const LEGACY_HANDOFF_TIME = "1970-01-01T00:00:00.000Z";

/** Collapse a stored legacy use-case onto the four V2 outcomes. */
export function normalizeOnboardingOutcome(
  useCase?: UseCaseType | string | null,
): OnboardingOutcome | undefined {
  if (!useCase) return undefined;
  if ((ONBOARDING_OUTCOMES as readonly string[]).includes(useCase)) {
    return useCase as OnboardingOutcome;
  }
  if (
    useCase === "saas" ||
    useCase === "consumer" ||
    useCase === "marketplace"
  ) {
    return "product_feedback";
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asIsoString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return Number.isNaN(Date.parse(value)) ? undefined : value;
}

function normalizeStartingPoint(value: unknown): StartingPointState | null {
  if (!isRecord(value)) return null;
  const outcome = normalizeOnboardingOutcome(
    typeof value.outcome === "string" ? value.outcome : undefined,
  );
  if (!outcome) return null;
  if (
    !(STARTING_POINT_RESOURCE_TYPES as readonly unknown[]).includes(
      value.resourceType,
    )
  )
    return null;
  if (!(STARTING_POINT_SOURCES as readonly unknown[]).includes(value.source))
    return null;
  if (
    !(STARTING_POINT_RESOLUTIONS as readonly unknown[]).includes(
      value.resolution,
    )
  )
    return null;
  const completedAt = asIsoString(value.completedAt);
  if (!completedAt) return null;
  return {
    outcome,
    resourceType: value.resourceType as StartingPointResourceType,
    ...(typeof value.resourceId === "string" && value.resourceId
      ? { resourceId: value.resourceId }
      : {}),
    source: value.source as StartingPointSource,
    resolution: value.resolution as StartingPointResolution,
    completedAt,
  };
}

function normalizeTaskResolutions(
  value: unknown,
): OutcomeTaskResolutions | undefined {
  if (!isRecord(value)) return undefined;
  const result: OutcomeTaskResolutions = {};
  for (const outcome of ONBOARDING_OUTCOMES) {
    const stored = value[outcome];
    if (!isRecord(stored)) continue;
    const tasks: Record<string, LaunchTaskResolution> = {};
    for (const [taskId, resolution] of Object.entries(stored)) {
      if (!isRecord(resolution)) continue;
      if (
        resolution.resolution !== "deferred" &&
        resolution.resolution !== "dismissed"
      )
        continue;
      const resolvedAt = asIsoString(resolution.resolvedAt);
      if (!resolvedAt) continue;
      tasks[taskId] = { resolution: resolution.resolution, resolvedAt };
    }
    if (Object.keys(tasks).length > 0) result[outcome] = tasks;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Pure, deterministic V1-to-V2 normalizer. Reads never write; the normalized
 * representation is persisted by the next setup-state mutation.
 *
 * Completed V1 workspaces are marked as already having seen the handoff so an
 * upgrade cannot unexpectedly redirect an established workspace back into
 * onboarding. The epoch fallback is intentionally stable for rows that lack a
 * completion timestamp.
 */
export function normalizeSetupStateV2(value: unknown): SetupState | null {
  if (!isRecord(value)) return null;
  const steps = isRecord(value.steps) ? value.steps : {};
  const legacyUseCase = normalizeOnboardingOutcome(
    typeof value.useCase === "string" ? value.useCase : undefined,
  );

  const selected = Array.isArray(value.goals)
    ? value.goals.filter(
        (goal): goal is OnboardingOutcome =>
          typeof goal === "string" &&
          (ONBOARDING_OUTCOMES as readonly string[]).includes(goal),
      )
    : [];
  const legacyInternal =
    legacyUseCase === "internal" || selected.includes("internal");
  const goals = [
    ...new Set(
      (selected.length ? selected : legacyUseCase ? [legacyUseCase] : []).map(
        (goal) => (goal === "internal" ? ("product_feedback" as const) : goal),
      ),
    ),
  ];
  const useCase = goals[0];
  const intent = {
    ...(goals.length ? { goals } : {}),
    ...(legacyInternal
      ? { feedbackPrivate: true }
      : typeof value.feedbackPrivate === "boolean"
        ? { feedbackPrivate: value.feedbackPrivate }
        : {}),
  };

  if (value.version === 2) {
    const startingPoint = normalizeStartingPoint(steps.startingPoint);
    const taskResolutions = normalizeTaskResolutions(value.taskResolutions);
    const completionSource =
      value.completionSource === "wizard" ||
      value.completionSource === "managed" ||
      value.completionSource === "legacy"
        ? value.completionSource
        : undefined;
    const storedMilestones = isRecord(value.activationMilestones)
      ? value.activationMilestones
      : undefined;
    const publicBoardLinkCopiedAt = asIsoString(
      storedMilestones?.publicBoardLinkCopiedAt,
    );
    const statusLinkCopiedAt = asIsoString(
      storedMilestones?.statusLinkCopiedAt,
    );
    const activationMilestones = {
      ...(publicBoardLinkCopiedAt ? { publicBoardLinkCopiedAt } : {}),
      ...(statusLinkCopiedAt ? { statusLinkCopiedAt } : {}),
    };
    return {
      version: 2,
      steps: {
        core: steps.core === true,
        workspace: steps.workspace === true,
        startingPoint,
      },
      ...(asIsoString(value.completedAt)
        ? { completedAt: value.completedAt as string }
        : {}),
      ...(typeof value.ownerPrincipalId === "string" &&
      value.ownerPrincipalId.startsWith("principal_")
        ? { ownerPrincipalId: value.ownerPrincipalId }
        : {}),
      ...(useCase ? { useCase } : {}),
      ...intent,
      ...(asIsoString(value.workspaceDetailsSeenAt)
        ? { workspaceDetailsSeenAt: value.workspaceDetailsSeenAt as string }
        : {}),
      ...(completionSource ? { completionSource } : {}),
      ...(asIsoString(value.activationHandoffSeenAt)
        ? { activationHandoffSeenAt: value.activationHandoffSeenAt as string }
        : {}),
      ...(taskResolutions ? { taskResolutions } : {}),
      ...(Object.keys(activationMilestones).length > 0
        ? { activationMilestones }
        : {}),
    };
  }

  const legacyComplete =
    steps.core === true && steps.workspace === true && steps.boards === true;
  const completedAt = asIsoString(value.completedAt);
  const migrationTime = completedAt ?? LEGACY_HANDOFF_TIME;
  const outcome = useCase ?? "product_feedback";
  const knownCompletionSource =
    value.completionSource === "wizard" || value.completionSource === "managed"
      ? value.completionSource
      : "legacy";
  const skipped = Array.isArray(value.skippedLaunchTasks)
    ? value.skippedLaunchTasks.filter(
        (task): task is string => typeof task === "string",
      )
    : [];
  const migratedTasks: Record<string, LaunchTaskResolution> = {};
  for (const taskId of skipped) {
    migratedTasks[taskId] = {
      resolution: LEGACY_POLISH_TASK_IDS.has(taskId) ? "dismissed" : "deferred",
      resolvedAt: migrationTime,
    };
  }

  return {
    version: 2,
    steps: {
      core: steps.core === true,
      workspace: steps.workspace === true,
      startingPoint: legacyComplete
        ? {
            outcome,
            resourceType: "none",
            source: "existing",
            resolution: "deferred",
            completedAt: migrationTime,
          }
        : null,
    },
    ...(completedAt ? { completedAt } : {}),
    ...(useCase ? { useCase } : {}),
    ...intent,
    ...(legacyComplete ? { completionSource: knownCompletionSource } : {}),
    ...(legacyComplete ? { activationHandoffSeenAt: migrationTime } : {}),
    ...(Object.keys(migratedTasks).length > 0
      ? { taskResolutions: { [outcome]: migratedTasks } }
      : {}),
  };
}

export function getSetupState(
  setupStateJson: string | null,
): SetupState | null {
  if (!setupStateJson) return null;
  try {
    return normalizeSetupStateV2(JSON.parse(setupStateJson));
  } catch {
    return null;
  }
}

export function isOnboardingComplete(setupState: SetupState | null): boolean {
  return Boolean(
    setupState?.steps.core &&
    setupState.steps.workspace &&
    setupState.steps.startingPoint,
  );
}

/**
 * A managed/provisioned workspace can satisfy {@link isOnboardingComplete}
 * without the owner ever seeing the "ready — here's what to do next" screen.
 * The public portal stays open for visitors; this is the admin-only last hop.
 */
export function needsActivationHandoff(setupState: SetupState | null): boolean {
  return (
    isOnboardingComplete(setupState) && !setupState?.activationHandoffSeenAt
  );
}

/**
 * Provision can stamp the wizard complete so a public board exists, but the
 * owner still has to set the workspace name and URL and pick a first goal.
 * Until they do, send them through the wizard — not the empty board, and not
 * the "you're ready" handoff.
 */
export function needsCloudOnboardingWizard(
  setupState: SetupState | null,
): boolean {
  if (!setupState || setupState.completionSource !== "managed") return false;
  if (!setupState.workspaceDetailsSeenAt) return true;
  return setupState.steps.startingPoint?.source === "managed";
}

/**
 * Resolve a board's reply policy. Every row that predates the setting (and
 * every board that never enabled it) carries no key, which means the
 * permissive default — so absent, null and undefined all read as `'anyone'`.
 */
export function resolveReplyPolicy(
  access: { replyPolicy?: ReplyPolicy } | null | undefined,
): ReplyPolicy {
  return access?.replyPolicy ?? "anyone";
}

// Helper to get typed board settings
export function getBoardSettings(board: Board): BoardSettings {
  const settings = (board.settings || {}) as BoardSettings;
  return {
    roadmapStatusIds: settings.roadmapStatusIds,
  };
}

// Roadmap types (filtered views of posts within a board)
export type Roadmap = InferSelectModel<typeof roadmaps>;
export type NewRoadmap = InferInsertModel<typeof roadmaps>;
export type RoadmapColumn = InferSelectModel<typeof roadmapColumns>;
export type NewRoadmapColumn = InferInsertModel<typeof roadmapColumns>;

// Post tag types (catalog + assignment junction)
export type PostTag = InferSelectModel<typeof postTags>;
export type NewPostTag = InferInsertModel<typeof postTags>;
export type PostTagAssignment = InferSelectModel<typeof postTagAssignments>;
export type NewPostTagAssignment = InferInsertModel<typeof postTagAssignments>;

// Post status types (customizable statuses)
export type PostStatusEntity = InferSelectModel<typeof postStatuses>;
export type NewPostStatusEntity = InferInsertModel<typeof postStatuses>;

// Post types
export type Post = InferSelectModel<typeof posts>;
export type NewPost = InferInsertModel<typeof posts>;

// Vote types
export type PostVote = InferSelectModel<typeof postVotes>;
export type NewPostVote = InferInsertModel<typeof postVotes>;

// Comment types
export type PostComment = InferSelectModel<typeof postComments>;
export type NewPostComment = InferInsertModel<typeof postComments>;

// Post note types (internal staff notes)
export type PostNote = InferSelectModel<typeof postNotes>;
export type NewPostNote = InferInsertModel<typeof postNotes>;

// Comment reaction types
export type PostCommentReaction = InferSelectModel<typeof postCommentReactions>;
export type NewPostCommentReaction = InferInsertModel<
  typeof postCommentReactions
>;

// Support-inbox conversation statuses — kept in sync with the conversations.status
// column enum (schema.test.ts pins the match). 'snoozed' is a deferred-work state
// with an explicit conversations.snoozed_until wake time (NULL = snoozed until the
// customer next replies); it replaced the earlier 'pending' in migration 0139.
export const CONVERSATION_STATUSES = ["open", "snoozed", "closed"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

// Why a conversation was ended (conversations.end_reason). A plain-text column
// whose allowed values live here as the single source of truth for validation
// + the end-conversation UI. Resolution-rate (for later analytics) =
// count(end_reason IN ('resolved','tracked_as_feedback')) / count(all ended
// EXCLUDING 'spam').
export const CONVERSATION_END_REASONS = [
  "resolved",
  "tracked_as_feedback",
  "duplicate",
  "no_response",
  "spam",
  "other",
] as const;
export type ConversationEndReason = (typeof CONVERSATION_END_REASONS)[number];

// Which rule or classifier filed a spam-ended conversation
// (conversations.spam_reason). The deterministic signal values mirror
// SPAM_SIGNALS in the conversation domain; 'ai_classifier' is the AI
// fallback verdict and 'manual' an agent's own filing. A plain-text column
// whose allowed values live here as the single source of truth for the
// Spam view's reason badge.
//
// The three sender_auth_* values are one family, split because they are three
// different things to a person deciding whether to release the message:
//   - sender_auth_failure     the MTA reported DMARC fail under a policy that
//                             does not ask us to refuse (p=none/quarantine).
//   - sender_auth_reject      DMARC fail under p=reject, with no validated ARC
//                             chain. The author domain asked us to refuse it.
//   - sender_auth_arc_rescued DMARC fail under p=reject, but our MTA validated
//                             an ARC chain, so an intermediary vouched for a
//                             message we cannot tie to the From domain
//                             ourselves. The forwarding-gateway shape, and the
//                             one most likely to be a real customer.
// Collapsing them would erase exactly the distinction that tells an agent
// which quarantined mail is worth releasing.
//
// 'mail_loop_suspected' is the same shape of judgement about a different
// question: the ingest path's guess that this message is one of the workspace's
// own mails coming back. It badges a message filed rather than destroyed
// BECAUSE it is a guess — see INBOUND_REFUSAL_CAUSES in the conversation domain
// for what the guess is made of and why it is retained.
export const CONVERSATION_SPAM_FILED_BY = [
  "auto_responder",
  "sender_auth_failure",
  "sender_auth_reject",
  "sender_auth_arc_rescued",
  "mail_loop_suspected",
  "burst_rate",
  "ai_classifier",
  "manual",
] as const;
export type ConversationSpamFiledBy =
  (typeof CONVERSATION_SPAM_FILED_BY)[number];

// Per-agent manual availability (principal.chat_availability). 'online' = route
// chats to me when connected; 'away' = connected but opted out of routing.
export const AGENT_AVAILABILITY_VALUES = ["online", "away"] as const;
export type AgentAvailability = (typeof AGENT_AVAILABILITY_VALUES)[number];

// The inbound channel a conversation arrived on — kept in sync with the
// conversations.channel column enum. Widget threads are 'messenger' (ticket
// intake forms mint messenger-channel backing conversations with source
// 'ticket_form'); 'email' threads point at their inbound channel account;
// 'github' threads are a connected repository's issues. This keeps one
// polymorphic conversation object with a channel field, not a per-channel table.
export const CHANNELS = ["messenger", "email", "github"] as const;
export type Channel = (typeof CHANNELS)[number];

// Agent-set conversation priority for inbox triage — kept in sync with the
// conversations.priority column enum. 'none' = unset (the default).
export const CONVERSATION_PRIORITIES = [
  "none",
  "low",
  "medium",
  "high",
  "urgent",
] as const;
export type ConversationPriority = (typeof CONVERSATION_PRIORITIES)[number];

// Ticket kind (support platform §4.2) — kept in sync with the tickets.type column
// enum. 'customer' is the customer-visible support request (at most one per
// conversation); 'back_office' is an internal task; 'tracker' is an umbrella that
// fans work out to linked tickets via ticket_links.
export const TICKET_TYPES = ["customer", "back_office", "tracker"] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

// Coarse lifecycle bucket a ticket status rolls up to for reporting and inbox
// grouping — kept in sync with the ticket_statuses.category column enum.
export const TICKET_STATUS_CATEGORIES = ["open", "pending", "closed"] as const;
export type TicketStatusCategory = (typeof TICKET_STATUS_CATEGORIES)[number];

// Requester-facing stage a ticket status projects to (ticket_statuses.public_stage).
// A NULL public_stage hides the status from the requester entirely; these values
// are the only labels a customer ever sees, decoupled from internal status names.
export const TICKET_STAGES = [
  "received",
  "in_progress",
  "awaiting_requester",
  "resolved",
] as const;
export type TicketStage = (typeof TICKET_STAGES)[number];

// How a team-assigned conversation picks a member — kept in sync with the
// teams.assignment_method column enum. 'manual' assigns the team only (no
// member pick); 'round_robin' rotates over online members; 'balanced' reuses
// the least-loaded auto-assign strategy scoped to the team's members.
export const TEAM_ASSIGNMENT_METHODS = [
  "manual",
  "round_robin",
  "balanced",
] as const;
export type TeamAssignmentMethod = (typeof TEAM_ASSIGNMENT_METHODS)[number];

// Which side of a conversation a message came from — kept in sync with the
// conversation_messages.sender_type column enum. 'system' rows are status events (e.g.
// assignment) shown to both sides; attributed to the relevant agent's principal
// and never counted as unread.
export const MESSAGE_SENDER_TYPES = ["visitor", "agent", "system"] as const;
export type MessageSenderType = (typeof MESSAGE_SENDER_TYPES)[number];

// A single attachment ref stored on a conversation message (conversation_messages.attachments).
// Files uploaded through the file pipeline carry `fileId` (a `files` row whose
// type and size were read from the stored bytes) and whatever preview data was
// ready when the message was written or since. Rows written before the
// pipeline, and inline images lifted from rich content, have neither.
export interface ConversationAttachment {
  url: string;
  name: string;
  contentType: string;
  size: number;
  fileId?: string;
  family?: StoredFileFamily;
  preview?: FilePreviewMeta;
}

/** Mirrors `FileFamily` in the app's file-type registry (files.family). */
export type StoredFileFamily =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "csv"
  | "text"
  | "code"
  | "archive"
  | "other";

/**
 * What a file's card and viewer can show without opening the file. Written by
 * the preview job onto the `files` row and copied onto the message attachment.
 * Every field is optional: a family fills only what it has.
 */
export interface FilePreviewMeta {
  /** Pages of a PDF or a Word document, slides of a presentation. */
  pages?: number;
  /** Sheet names of a workbook, in order. */
  sheets?: string[];
  /** Data rows of the first sheet or of a CSV. */
  rows?: number;
  /** Lines of a text file. */
  lines?: number;
  /** Entries in an archive. */
  entries?: number;
  width?: number;
  height?: number;
  durationMs?: number;
  /** First rows of a sheet or CSV as display text, for the card's mini grid. */
  head?: string[][];
  /** First lines of a text file, for the card. */
  text?: string;
  /** Storage key of a rendered thumbnail (page one of a PDF, a scaled image). */
  thumbKey?: string;
  /** Storage key of a browser-viewable rendition (a HEIC photo as JPEG). */
  renditionKey?: string;
  /** An Office file that carries a VBA project. */
  macro?: boolean;
}

// A source the AI assistant grounded a message in (conversation_messages.citations).
// The message text carries inline [n] markers that index into this ordered list.
// `type` mirrors ASSISTANT_CITATION_TYPES (apps/web citation-types.ts); a
// standalone copy here so the db package owns no dependency on the app.
export interface ConversationMessageCitation {
  type:
    | "article"
    | "post"
    | "snippet"
    | "summary"
    | "ticket"
    | "changelog"
    | "document"
    | "webpage";
  id: string;
  title: string;
  url: string;
}

// Channel provenance stored on a conversation message (conversation_messages.metadata).
// Null for ordinary in-app messenger messages; set when a message arrives over
// another channel so the inbox can render it and dedupe provider retries.
/** Author-less 'system' status events (conversation ended/reopened, assignment). */
// NOTE: the stored kind values keep the chat_ prefix until the Phase B data
// migration rewrites conversation_messages.metadata.
export type ConversationSystemEventKind =
  | "chat_ended"
  | "chat_reopened"
  | "assigned"
  | "assistant_handoff"
  | "ticket_status_changed"
  | "ticket_linked"
  | "ticket_created"
  | "assistant_action_expired"
  | "external_linked"
  | "external_unlinked"
  | "external_status_changed"
  | "priority_changed"
  | "snoozed"
  | "csat_submitted";

export interface ConversationSystemEvent {
  kind: ConversationSystemEventKind;
  /** Assignee display name for 'assigned'. */
  agentName?: string;
  /** Customer-facing stage label for 'ticket_status_changed' (never the raw
   *  internal status name). Absent when `closed` is set. */
  stageLabel?: string;
  /** B22: true on a 'ticket_status_changed' for a close via a null-publicStage
   *  status ("Won't do", "Duplicate"): the thread marker is the generic
   *  localized "Ticket closed" projection — the internal status name is never
   *  carried here (that is the point of the null stage). */
  closed?: boolean;
  /** Tracker reference (e.g. "#12") for 'ticket_linked' — team-only. */
  trackerReference?: string;
  /** Ticket reference (e.g. "#42") for 'ticket_created' (unified inbox M5's
   *  create-ticket flow). CONVERGENCE: on the shared conversation↔ticket
   *  thread this is the customer-visible conversion marker, localized
   *  client-side from this event — the visitor it renders for is the ticket's
   *  own requester. The same kind carries a non-customer ticket opened from a
   *  conversation, where the row is internal and the audience is the team; the
   *  audience rides `isInternal`, not the kind. */
  ticketReference?: string;
  /** External issue reference (e.g. "acme/widgets#142") for
   *  'external_linked' / 'external_unlinked' — team-only. */
  externalReference?: string;
  /** External issue URL for 'external_linked' / 'external_unlinked' — team-only. */
  externalUrl?: string;
  /** New priority for 'priority_changed' — team-only (the row is internal). */
  priority?: ConversationPriority;
  /** CSAT rating (1-5) for 'csat_submitted' — team-only (the row is internal). */
  rating?: number;
  /** Name of the workflow whose run posted this notice, when one did. Lets
   *  the thread attribute the event to the automation that fired it ("via
   *  <name>") instead of leaving it indistinguishable from a teammate's
   *  manual action. Absent on every manually-triggered notice. */
  workflowName?: string;
}

/**
 * Stamp workflow attribution onto a system event: a notice posted because a
 * workflow fired names that workflow. Returns the event unchanged when there
 * is no workflow to name (a manual/agent action), so callers can thread an
 * optional name through unconditionally. Never mutates the input.
 */
export function withWorkflowAttribution(
  event: ConversationSystemEvent,
  workflowName: string | null | undefined,
): ConversationSystemEvent {
  const name = workflowName?.trim();
  return name ? { ...event, workflowName: name } : event;
}

// An agent-only suggestion (carried on an internal note) to track a resolved
// conversation as a feedback post. Surfaced exclusively via the agent DTO — it
// never reaches the visitor.
export interface PostSuggestion {
  boardId: string;
  title: string;
  content: string;
}

// A write-tool call Quinn proposed but has not executed, surfaced on an
// internal note (conversation_messages.metadata) so the team sees it without
// polling. A point-in-time snapshot only — the pending action row is the live
// source of truth an agent approves/rejects from.
export interface AssistantPendingActionSurface {
  pendingActionId: string;
  toolName: string;
  summary: string;
}

// Workflow conversational-block layer (Phase C, slice C-1). A block is an
// ordinary senderType:'agent' message authored by the assistant service
// principal; its structured shape lives in metadata.block, mirroring the
// systemEvent precedent — content ALWAYS carries an honest plain-text
// fallback, contentJson carries the resolved rich prompt body (variables
// already substituted server-side; a raw {token} never reaches storage).
export type WorkflowBlockKind =
  | "message"
  // The in-thread ticket intake form (send_ticket_form node) — a SEND kind,
  // never in INTERACTIVE_BLOCK_KINDS: it posts and continues immediately.
  | "ticketForm"
  | "buttons"
  | "collect"
  | "collectReply"
  | "csat"
  | "replyTime";

/** Block kinds that park the run awaiting a customer reply — the only ones
 *  that ever produce a BlockState (widget conversation-rows.ts's derivation)
 *  or need an active-run check before continuing (the engine's
 *  action.executor.ts). The remaining kinds (message/replyTime) post and
 *  continue immediately. */
export const INTERACTIVE_BLOCK_KINDS: ReadonlySet<WorkflowBlockKind> = new Set([
  "buttons",
  "collect",
  "collectReply",
  "csat",
]);

/** The five CSAT satisfaction faces, low to high — index = rating-1. The one
 *  canonical order/glyph set every surface that renders or echoes a CSAT
 *  rating shares: the widget's block affordance row, the admin inbox's
 *  read-only summary, the server's stored-reply echo + honest plain-text
 *  fallback, and the workflow builder's rating-path labels. */
export const CSAT_FACES = ["😞", "🙁", "😐", "🙂", "😄"] as const;

/**
 * Approval vocabulary. A pending action is an approval: the server sets its
 * risk for the operation, records how it arrived and how it was decided, and
 * tracks its execution apart from the decision. None of these columns carries
 * a CHECK; the application validates every value it writes.
 */
export const APPROVAL_RISKS = ["low", "medium", "high", "critical"] as const;
export type ApprovalRisk = (typeof APPROVAL_RISKS)[number];

export const APPROVAL_REQUEST_CHANNELS = [
  "ui",
  "api",
  "mcp",
  "assistant",
  "workflow",
] as const;
export type ApprovalRequestChannel = (typeof APPROVAL_REQUEST_CHANNELS)[number];

export const APPROVAL_DECISION_CHANNELS = [
  "app",
  "email",
  "assistant",
  "slack",
] as const;
export type ApprovalDecisionChannel =
  (typeof APPROVAL_DECISION_CHANNELS)[number];

export const APPROVAL_EXECUTION_STATES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "unknown",
] as const;
export type ApprovalExecutionState = (typeof APPROVAL_EXECUTION_STATES)[number];

interface WorkflowBlockPayloadBase {
  /** Payload schema version, so a future shape change can branch on it. */
  v: 1;
  /** The workflow run that posted this block. */
  runId: string;
  /** The graph node that posted this block. */
  nodeId: string;
  /** True for an interactive kind that parked the run awaiting this exact
   *  reply (buttons/collect/collectReply/csat); false for a SEND kind
   *  (message/replyTime) that posted and continued immediately. */
  waiting: boolean;
}

export interface WorkflowBlockButtonOption {
  key: string;
  label: string;
}

/** A snapshot of one collect-data option (select/multi_select fields), so a
 *  later definition edit can't retroactively change what the customer chose
 *  from. */
export interface WorkflowBlockAttributeOption {
  id: string;
  label: string;
}

export type WorkflowBlockPayload =
  | (WorkflowBlockPayloadBase & { kind: "message" })
  // The ticket intake form sent into the thread by a workflow's
  // send_ticket_form node: a SEND kind (waiting always false) — the widget
  // renders the form card for this kind and the visitor files the ticket
  // in-thread; there is no structured block reply to correlate.
  | (WorkflowBlockPayloadBase & { kind: "ticketForm" })
  | (WorkflowBlockPayloadBase & {
      kind: "buttons";
      options: WorkflowBlockButtonOption[];
      allowTyping: boolean;
    })
  | (WorkflowBlockPayloadBase & {
      kind: "collect";
      attributeKey: string;
      fieldType: "text" | "number" | "select" | "date";
      options?: WorkflowBlockAttributeOption[];
      required: boolean;
    })
  | (WorkflowBlockPayloadBase & { kind: "collectReply"; attributeKey: string })
  | (WorkflowBlockPayloadBase & {
      kind: "csat";
      allowTypingInterrupt: boolean;
      commentPrompt: string;
    })
  | (WorkflowBlockPayloadBase & {
      kind: "replyTime";
      status: "online" | "away";
    });

/** The customer's structured reply to a block, stored on the VISITOR message
 *  it was sent as. `inReplyToMessageId` is the block message's own id — the
 *  correlation key (unique per park occurrence, collision-proof where
 *  runId+nodeId is not, since a graph can revisit the same node). */
export type BlockReplyMetadata =
  | { kind: "buttons"; inReplyToMessageId: string; buttonKey: string }
  | {
      kind: "collect";
      inReplyToMessageId: string;
      value: string | number | boolean;
    }
  | { kind: "collectReply"; inReplyToMessageId: string; value: string }
  | {
      kind: "csat";
      inReplyToMessageId: string;
      rating: number;
      comment?: string;
    };

/** Outbound delivery of an agent reply onto a thread-addressed channel
 *  (the customer's GitHub issue, etc.). Pending at insert; sent once the
 *  provider accepts; failed if the post does not land. Messenger/email
 *  replies do not carry this. */
export type ChannelDeliveryStatus = "pending" | "sent" | "failed";

export interface ChannelDelivery {
  status: ChannelDeliveryStatus;
  channel: Channel;
  /** ISO timestamp of the last status change. */
  at: string;
  /** Provider-side id once accepted (GitHub issue comment id). */
  externalId?: string;
  /** Short agent-facing reason when status is failed. */
  error?: string;
}

export interface ConversationMessageMetadata {
  /** Private workspace turn identity and its server-authored final payload. */
  workspaceTurn?: { runId: string; payload?: Record<string, unknown> };

  /** The channel this message arrived through, when not the in-app messenger. */
  source?: "email" | "github";
  /** GitHub issue comment REST id, used to dedupe webhook retries. */
  githubCommentId?: string;
  /** Live outbound status for a thread-addressed channel send. */
  channelDelivery?: ChannelDelivery;
  /** GitHub issue number for the message's thread, when known. */
  githubIssueNumber?: string;
  /** Tracker inbound webhook body hash, used to dedupe redelivered status notes. */
  inboundDeliveryKey?: string;
  /** Provider Message-ID for an inbound email, used to dedupe webhook retries. */
  emailMessageId?: string;
  /** RFC 5322 threading of an inbound email message: the parent it replied to
   *  and the full References chain (bare ids). Populated on the email channel. */
  inReplyTo?: string;
  references?: string[];
  /** The email Subject + Cc participants at the time this message arrived
   *  (§4.8). Bcc is never stored — it is stripped at ingest. */
  subject?: string;
  cc?: string[];
  /** For 'system' messages: the structured event, so clients can localize the
   *  notice instead of rendering the stored (English) content. */
  systemEvent?: ConversationSystemEvent;
  /** Agent-only suggestion (on an internal note) to track this conversation as a
   *  feedback post. Surfaced only via the agent DTO, never to the visitor. */
  postSuggestion?: PostSuggestion;
  /** Agent-only snapshot (on an internal note) of a write-tool proposal Quinn
   *  surfaced for approval. Surfaced only via the agent DTO, never to the visitor. */
  assistantPendingAction?: AssistantPendingActionSurface;
  /** Agent-only (P2-D.1 inbox translation): set on an OUTGOING reply sent while
   *  translation was active for the conversation. `content`/`content_json` on
   *  this row are the customer-language translation actually sent; this
   *  preserves the teammate's pre-translation original so the team can toggle
   *  back to "Show original". Surfaced only via the agent DTO, never to the
   *  visitor. */
  translatedFrom?: TranslatedFromMetadata;
  /** The structured block this assistant-authored message renders (Phase C
   *  conversational block layer). Null/absent for an ordinary message. */
  block?: WorkflowBlockPayload;
  /** The structured reply this visitor-authored message carries, when it was
   *  sent in answer to a block. Null/absent for an ordinary message. */
  blockReply?: BlockReplyMetadata;
  /** The ticket whose internal note this message carries, set on the copy a
   *  provenance-linked ticket lands on the conversation it was opened from.
   *  A note carrying it is never carried again, so a copy that finds its way
   *  back onto a ticket thread stops there. */
  crossPostedFromTicketId?: TicketId;
  /** The tracker whose reply-all this message is a fanned copy of, set on each
   *  copy a tracker reply lands on the customer tickets it tracks. A reply
   *  carrying it never fans again, so a copy that finds its way back onto a
   *  tracker thread stops there. */
  repliedAllFromTicketId?: TicketId;
}

/** See `ConversationMessageMetadata.translatedFrom`. */
export interface TranslatedFromMetadata {
  /** The teammate's original, pre-translation text. */
  originalContent: string;
  /** The teammate's own language at send time (their preference, or the
   *  'en' fallback when unset). */
  sourceLocale: string;
  /** The customer's language the reply was translated (and sent) into —
   *  matches this message's actual stored `content`. */
  targetLocale: string;
}

// Support-inbox conversation row types
export type Conversation = InferSelectModel<typeof conversations>;
export type NewConversation = InferInsertModel<typeof conversations>;
export type ConversationMessage = InferSelectModel<typeof conversationMessages>;
export type NewConversationMessage = InferInsertModel<
  typeof conversationMessages
>;
export type ConversationTag = InferSelectModel<typeof conversationTags>;
export type NewConversationTag = InferInsertModel<typeof conversationTags>;
export type ConversationMessageMention = InferSelectModel<
  typeof conversationMessageMentions
>;
export type NewConversationMessageMention = InferInsertModel<
  typeof conversationMessageMentions
>;
export type ConversationMessageReaction = InferSelectModel<
  typeof conversationMessageReactions
>;
export type NewConversationMessageReaction = InferInsertModel<
  typeof conversationMessageReactions
>;
export type ConversationMessageFlag = InferSelectModel<
  typeof conversationMessageFlags
>;
export type NewConversationMessageFlag = InferInsertModel<
  typeof conversationMessageFlags
>;
export type ConversationMessageTranslation = InferSelectModel<
  typeof conversationMessageTranslations
>;
export type NewConversationMessageTranslation = InferInsertModel<
  typeof conversationMessageTranslations
>;

// Teams (§4.12) row types
export type Team = InferSelectModel<typeof teams>;
export type NewTeam = InferInsertModel<typeof teams>;
export type TeamMember = InferSelectModel<typeof teamMembers>;
export type NewTeamMember = InferInsertModel<typeof teamMembers>;

// Tickets (§4.2) row types
export type Ticket = InferSelectModel<typeof tickets>;
export type NewTicket = InferInsertModel<typeof tickets>;
export type TicketStatusEntity = InferSelectModel<typeof ticketStatuses>;
export type NewTicketStatusEntity = InferInsertModel<typeof ticketStatuses>;
export type TicketTypeEntity = InferSelectModel<typeof ticketTypes>;
export type NewTicketTypeEntity = InferInsertModel<typeof ticketTypes>;
export type TicketConversation = InferSelectModel<typeof ticketConversations>;
export type NewTicketConversation = InferInsertModel<
  typeof ticketConversations
>;
export type TicketLink = InferSelectModel<typeof ticketLinks>;
export type NewTicketLink = InferInsertModel<typeof ticketLinks>;
export type TicketActivityEntity = InferSelectModel<typeof ticketActivity>;
export type NewTicketActivityEntity = InferInsertModel<typeof ticketActivity>;

// Reaction emoji constants (client-safe)
export const REACTION_EMOJIS = ["👍", "❤️", "🎉", "😄", "🤔", "👀"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

// Integration types
export type Integration = InferSelectModel<typeof integrations>;
export type NewIntegration = InferInsertModel<typeof integrations>;
export type IntegrationStatus = Integration["status"];

// Changelog types
export type ChangelogEntry = InferSelectModel<typeof changelogEntries>;
export type NewChangelogEntry = InferInsertModel<typeof changelogEntries>;
export type ChangelogEntryPost = InferSelectModel<typeof changelogEntryPosts>;
export type NewChangelogEntryPost = InferInsertModel<
  typeof changelogEntryPosts
>;

// Principal types
export type Principal = InferSelectModel<typeof principal>;
export type NewPrincipal = InferInsertModel<typeof principal>;

// Labs experiments (one row per workspace + registered experiment id)
export type WorkspaceExperiment = InferSelectModel<typeof workspaceExperiments>;
export type NewWorkspaceExperiment = InferInsertModel<
  typeof workspaceExperiments
>;

// Extended types for queries with relations
export type CommentWithReplies = Comment & {
  replies: CommentWithReplies[];
  reactions: PostCommentReaction[];
};

export type PostWithDetails = Post & {
  board: Board;
  tags: PostTag[];
  comments: CommentWithReplies[];
  votes: PostVote[];
};

// Inbox query types
export type PostListItem = Post & {
  board: Pick<Board, "id" | "name" | "slug">;
  tags: Pick<PostTag, "id" | "name" | "color">[];
  commentCount: number;
  authorName: string | null;
};

export interface InboxPostListResult {
  items: PostListItem[];
  nextCursor: string | null;
  hasMore: boolean;
  /** Set when no post matched every word of the search and it was widened. */
  searchMode?: "most" | "similar";
}

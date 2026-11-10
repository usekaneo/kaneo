import { userTable } from "../../schema";
import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { check, primaryKey, unique } from "drizzle-orm/pg-core";
/**
 * Better-auth schema for Drizzle ORM integration.
 *
 * Uses TypeID format (uuid storage with type-prefixed strings in app layer).
 * This matches the pattern used by application tables (posts, boards, etc.).
 *
 * @see https://www.better-auth.com/docs/adapters/drizzle
 */

import {
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
  jsonb,
  integer,
  foreignKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  typeIdWithDefault,
  typeIdColumn,
  typeIdColumnNullable,
} from "@kaneo/ids/drizzle";

import { companies } from "./companies";

export interface StoredAssistantVoice {
  tone: string;
  responseLength: string;
  additionalInstructions: string;
}

/**
 * Structural twin of `AssistantConfig` (z.infer of `assistantConfigSchema` in
 * apps/web `lib/shared/assistant/config.ts`). packages/db can't import apps/web,
 * so this hand-written interface mirrors that schema's shape with widened
 * primitives (string/number instead of the enum/literal types). A drift tripwire
 * in apps/web (`lib/shared/assistant/__tests__/config.test.ts`) asserts the two
 * stay structurally identical — edit both sides together.
 */
export interface StoredAssistantConfig {
  version: number;
  identity: { name: string; avatarUrl: string | null };
  agents: {
    workspace: {
      capabilities: { qa: boolean };
      knowledge: StoredAssistantConfig["agents"]["copilot"]["knowledge"];
      toolRules: Record<string, string>;
      instructions: string;
      slack: {
        enabled: boolean;
        respondTo: string;
        allowUnlinkedPublicQa: boolean;
      };
    };
    agent: {
      voice: StoredAssistantVoice;
      knowledge: {
        helpCenter: boolean;
        posts: boolean;
        changelog: boolean;
        documents: boolean;
        status: boolean;
      };
      toolRules: Record<string, string>;
    };
    copilot: {
      capabilities: { qa: boolean };
      knowledge: {
        helpCenter: boolean;
        posts: boolean;
        pastConversations: boolean;
        internalNotes: boolean;
        tickets: boolean;
        changelog: boolean;
        documents: boolean;
        status: boolean;
      };
      toolRules: Record<string, string>;
    };
  };
}

/** Storage-only shape for the narrow control-plane projection. A NULL cloud
 * column is the default for every self-hosted workspace. */
export interface StoredProjectedLimits {
  maxBoards: number | null;
  maxPosts: number | null;
  maxTeamSeats: number | null;
  maxStatusComponents: number | null;
  maxCustomRoles: number | null;
  maxSendingDomains: number | null;
  aiTokensPerMonth: number | null;
  apiRequestsPerMonth: number | null;
  apiRequestsPerMinute: number | null;
}

/** Commercial state safe to project from the control plane into a workspace. */
export interface StoredBillingProjection {
  version: number;
  effectivePlan: string;
  trialStartedAt: string | null;
  trialExpiresAt: string | null;
  subscriptionStatus: string | null;
  entitlements: Record<string, boolean>;
  freeLimits: StoredProjectedLimits;
  planLimits: StoredProjectedLimits;
  planLimitsExpireAt: string | null;
  canUpgrade: boolean;
  canManageBilling: boolean;
  renewalAt: string | null;
  cancellationAt: string | null;
}

export interface StoredCloudConfig {
  enabled: boolean;
  /** Signed, monotonic commercial state projected by the control plane. */
  projection?: StoredBillingProjection | null;
}

export interface StoredCloudCustomDomain {
  hostname: string;
  readiness: "pending" | "ready" | "failed";
  isPrimary: boolean;
  updatedAt: string;
}

/** Customer-safe cloud identity; provider ids and validation secrets never cross. */
export interface StoredCloudIdentityProjection {
  version: number;
  displayName: string;
  canonicalOrigin: string;
  /** Friendly Quackback hostname, null until the owner chooses one. */
  platformHostname: string | null;
  customDomains: StoredCloudCustomDomain[];
  updatedAt: string;
}

/**
 * User table - User identities for the application
 */
export const user = quillsSchema
  .table(
    "customer_identity",
    {
      kaneoUserId: text("kaneo_user_id").references(() => userTable.id, {
        onDelete: "set null",
      }),
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("user")("id").notNull(),
      name: text("name").notNull(),
      /** Nullable — external users (Slack, etc.) may not have a real email */
      email: text("email"),
      emailVerified: boolean("email_verified").default(false).notNull(),
      image: text("image"),
      // Profile image - S3 storage key (e.g., "avatars/2026/02/abc123-avatar.png")
      imageKey: text("image_key"),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
      // General user metadata (JSON)
      metadata: text("metadata"),
      // BCP-47 locale claim from OIDC (e.g. "en", "en-US"); NULL for
      // sign-up paths that don't carry one (magic-link, password).
      locale: text("locale"),
      // Teammate-set language preference (BCP-47 tag, e.g. "en", "fr",
      // "pt-BR"). Distinct from `locale` above: that's an IdP claim captured
      // at sign-up, this is a value the teammate explicitly chooses via
      // Settings. NULL means no preference / use the workspace default. Not
      // constrained to a fixed catalogue -- inbox translation (P2-D) reads
      // this to decide what language to translate into.
      preferredLanguage: text("preferred_language"),
      // ISO-3166-1 alpha-2 country code captured from CDN-injected
      // headers (CF-IPCountry, X-Vercel-IP-Country, Fly-Client-IP-Country,
      // X-Country-Code) on session creation. NULL when no header is
      // present — local dev or deployments without a geo-aware proxy.
      country: text("country"),
      // Stable external identity for widget-identified visitors: the verified JWT
      // `sub` (the host app's durable user id). Set ONLY on the verified ssoToken
      // identify path so a visitor is recognized on a new device even after an
      // email change. Null for team accounts and unverified identifies.
      externalId: text("external_id"),
      // Anonymous user flag (Better Auth anonymous plugin)
      isAnonymous: boolean("is_anonymous").default(false).notNull(),
      // Better-Auth twoFactor plugin — flips true once the user verifies
      // their TOTP secret. Read by the sign-in flow to decide whether to
      // emit the 2FA challenge response (`twoFactorRedirect: true`).
    },
    (table) => [
      // Email is unique when present (partial index — nulls are allowed)
      uniqueIndex("user_email_idx")
        .on(table.workspaceId, table.email)
        .where(sql`email IS NOT NULL`),
      // Functional index on LOWER(email) — backs the case-insensitive
      // lookups in recovery-codes-consume.ts, segment.evaluation.ts, and
      // routes/api/widget/identify.ts. Without it those queries seq-scan.
      index("user_email_lower_idx")
        .on(sql`LOWER(${table.email})`)
        .where(sql`email IS NOT NULL`),
      // One account per external subject — backs the verified-identify lookup and
      // stops two users claiming the same host-app `sub`. Partial: nulls allowed.
      uniqueIndex("user_external_id_idx")
        .on(table.workspaceId, table.externalId)
        .where(sql`external_id IS NOT NULL`),
      // Partial b-tree on country / locale — both are referenced by the
      // dynamic-segment evaluator (IN / ILIKE predicates) and the column
      // is sparse, so partial indexes keep the on-disk footprint small.
      index("user_country_idx")
        .on(table.country)
        .where(sql`country IS NOT NULL`),
      index("user_locale_idx")
        .on(table.locale)
        .where(sql`locale IS NOT NULL`),
      // Trigram GIN index backing the admin people-search substring match:
      //   WHERE name ILIKE '%term%'  (users/user.service.ts, principal.service.ts).
      // A leading-wildcard ILIKE cannot use a btree, so mirror the
      // principal_display_name_trgm_idx approach with a gin_trgm_ops index.
      index("user_name_trgm_idx").using("gin", sql`${table.name} gin_trgm_ops`),
      // Workspace search matches an email anywhere inside (0309).
      index("user_email_trgm_idx").using("gin", table.email.op("gin_trgm_ops")),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      unique().on(table.workspaceId, table.kaneoUserId),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/**
 * Two-factor enrolments managed by Better-Auth's twoFactor plugin.
 *
 * One row per user once TOTP is enabled. `secret` is the symmetric-
 * encrypted TOTP shared secret; `backupCodes` is a packed string of
 * one-time recovery codes (also encrypted). `verified` flips false
 * during the brief window between `/two-factor/enable` and the
 * subsequent `/two-factor/verify-totp`; the default `true` matches
 * Better-Auth's expectation for newly-inserted rows.
 *
 * `failedVerificationCount` / `lockedUntil` are the 1.6.30 account-
 * lockout fields. The plugin writes both on every TOTP verify (success
 * resets, failure increments). Drizzle drops unknown keys from `.set()`,
 * so omitting them produces `update "two_factor" set  where …` and
 * enrolment / sign-in 500. See #432.
 */

/**
 * The name and avatar URL an identity provider last wrote to an account's
 * user, each kept only while the user's stored value still equals it. Profile
 * sync on sign-in refreshes a recorded field and never one a person chose.
 *
 * A table of its own rather than columns on `account`: Better-Auth's adapter
 * selects every `account` column, so a column there would fail every sign-in
 * on a database that has not applied its migration yet. Nothing in Better-Auth
 * reads this table. See 0292.
 */

/**
 * One-time token table - Used by better-auth oneTimeToken plugin
 * for secure cross-domain session transfer after workspace provisioning
 */

/**
 * Settings table - Application settings and branding configuration
 *
 * For single-workspace OSS deployments, this table has one row containing
 * all application settings. The id, name, and slug are kept for display
 * and branding purposes.
 */
export const settings = quillsSchema
  .table(
    "settings",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("workspace")("id").notNull(), // Keep workspace prefix for TypeID compatibility
      catalogueVersion: integer("catalogue_version").notNull().default(0),
      name: text("name").notNull(),
      slug: text("slug").notNull(),
      // Logo - S3 storage key (e.g., "logos/2026/02/abc123-logo.png")
      logoKey: text("logo_key"),
      // Favicon - S3 storage key
      faviconKey: text("favicon_key"),
      // Header logo - S3 storage key
      headerLogoKey: text("header_logo_key"),
      // Portal social share (OG) image - S3 storage key
      portalOgImageKey: text("portal_og_image_key"),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
      metadata: text("metadata"),
      /**
       * Team authentication configuration (JSON)
       * Structure: { oauth: { google, github, microsoft }, ssoRequired, openSignup }
       */
      authConfig: text("auth_config"),
      /**
       * Portal configuration (JSON)
       * Structure: { oauth: { google, github }, features: { submissions, comments, voting } }
       */
      portalConfig: text("portal_config"),
      /**
       * Branding/theme configuration (JSON)
       * Structure: { preset?, light?: ThemeColors, dark?: ThemeColors }
       */
      brandingConfig: text("branding_config"),
      /**
       * Custom CSS for portal customization
       * Injected after theme styles in the portal layout
       */
      customCss: text("custom_css"),
      /**
       * Developer configuration (JSON)
       * Structure: { mcpEnabled: boolean }
       */
      developerConfig: text("developer_config"),
      /**
       * Header display mode - how the brand appears in portal navigation
       * - 'logo_and_name': Square logo + name (default)
       * - 'logo_only': Just the square logo
       * - 'custom_logo': Use headerLogoUrl (horizontal wordmark)
       */
      headerDisplayMode: text("header_display_mode").default("logo_and_name"),
      /**
       * Custom display name for the header (used in 'logo_and_name' mode)
       * Falls back to settings.name when not set
       */
      headerDisplayName: text("header_display_name"),
      /**
       * Setup/onboarding state tracking (JSON). See {@link SetupState} in
       * packages/db/src/types.ts for the source-of-truth shape.
       */
      setupState: text("setup_state"),
      /**
       * Versioned AI-agent identity and behavior configuration. The application
       * validates this JSONB value with the client-safe V3 schema before use.
       */
      assistantConfig: jsonb("assistant_config")
        .$type<StoredAssistantConfig>()
        .notNull()
        .default({
          version: 4,
          identity: { name: "Quinn", avatarUrl: null },
          agents: {
            workspace: {
              capabilities: { qa: true },
              knowledge: {
                helpCenter: true,
                posts: true,
                pastConversations: true,
                internalNotes: true,
                tickets: true,
                changelog: true,
                documents: true,
                status: true,
              },
              toolRules: {},
              instructions: "",
              slack: {
                enabled: false,
                respondTo: "mentions_and_dms",
                allowUnlinkedPublicQa: false,
              },
            },
            agent: {
              voice: {
                tone: "balanced",
                responseLength: "balanced",
                additionalInstructions: "",
              },
              knowledge: {
                helpCenter: true,
                posts: false,
                changelog: false,
                documents: true,
                status: false,
              },
              toolRules: {},
            },
            copilot: {
              capabilities: { qa: true },
              knowledge: {
                helpCenter: true,
                posts: true,
                pastConversations: true,
                internalNotes: true,
                tickets: true,
                changelog: true,
                documents: true,
                status: true,
              },
              toolRules: {},
            },
          },
        }),
      /** Optimistic-concurrency token incremented with every assistant config write. */
      assistantConfigRevision: integer("assistant_config_revision")
        .notNull()
        .default(1),
      /**
       * Widget configuration (JSON)
       * Structure: { enabled, defaultBoard?, position?, buttonText?, identifyVerification? }
       */
      widgetConfig: text("widget_config"),
      /**
       * Widget HMAC verification secret (separate column — NOT in JSON config)
       * Format: 'wgt_' + 64 hex chars
       */
      widgetSecret: text("widget_secret"),
      /** First externally embedded widget configuration observation. */
      widgetInstalledFirstSeenAt: timestamp("widget_installed_first_seen_at", {
        withTimezone: true,
      }),
      /** Most recent external observation, write-throttled by the public endpoint. */
      widgetInstalledLastSeenAt: timestamp("widget_installed_last_seen_at", {
        withTimezone: true,
      }),
      /** Normalized external Origin hostname only (no path, query, port, or scheme). */
      widgetInstalledOriginHost: text("widget_installed_origin_host"),
      /** Last SDK version reported on an install ping (`?sdk=` or instance-served sdk.js). */
      widgetInstalledSdkVersion: text("widget_installed_sdk_version"),
      /** Feature flags for experimental features (JSON) */
      featureFlags: text("feature_flags"),
      /**
       * Inbound spam-filter configuration (JSON)
       * Structure: { trustedSenders: string[], aiClassifier: boolean }.
       * trustedSenders: exact addresses or domains whose inbound messages bypass
       * spam classification entirely. aiClassifier: whether new conversations go
       * to the AI classifier (absent reads as on).
       */
      spamFilterConfig: text("spam_filter_config"),
      /**
       * Help center configuration (JSON)
       * Structure: { enabled, homepageTitle, homepageDescription, seo }
       */
      helpCenterConfig: text("help_center_config"),
      /**
       * Optional per-workspace tier limits (JSON-encoded TierLimits).
       * Written via /api/v1/admin/tier-limits (capability scope
       * `internal:tier-limits`) by operators who want to impose caps.
       * Null/absent means defaults (everything unlimited, all features
       * on).
       */
      tierLimits: text("tier_limits"),
      /**
       * Optional cloud configuration block (see {@link StoredCloudConfig}):
       * A signed, versioned billing projection from the control plane. It contains
       * only customer-safe UI and enforcement state, never provider references.
       *
       * NULL — the default, and the only value a self-hosted install ever has —
       * means no cloud config, which resolves to `enabled: false`: no plan, no
       * entitlement gating, no upsell.
       *
       * `tierLimits` above remains the persisted numeric baseline. Projected limits
       * are overlaid at read time and are never written into that baseline.
       */
      cloud: jsonb("cloud").$type<StoredCloudConfig>(),
      /**
       * Local change token incremented whenever a newer projection is accepted.
       * Projection monotonicity itself is enforced by `projection.version`.
       */
      cloudRevision: integer("cloud_revision").notNull().default(0),
      /** Signed cloud identity projection. NULL on self-hosted installs. */
      cloudIdentity:
        jsonb("cloud_identity").$type<StoredCloudIdentityProjection>(),
      /** Local write token, deliberately separate from cloudRevision/billing. */
      cloudIdentityRevision: integer("cloud_identity_revision")
        .notNull()
        .default(0),
      /**
       * JSON array of dot-paths whose values are managed by the
       * declarative config file (`/etc/quackback/config.yaml`). When a
       * path is in this list, the in-app UI mutator for that field
       * returns 403 and the form control is rendered disabled. The list
       * is rebuilt from scratch on every file reconcile, so removing a
       * key from the file unlocks the UI on the next reconcile tick.
       *
       * Example: ["workspace.name", "tierLimits", "features.helpCenter"].
       *
       * Whole-block lock: a managed path with no dots locks the entire
       * subtree (e.g. "tierLimits" locks "tierLimits.maxBoards" too).
       */
      managedFieldPaths: jsonb("managed_field_paths")
        .$type<string[]>()
        .notNull()
        .default([]),
      /**
       * Workspace state. INERT: app-level suspension enforcement was removed —
       * dormant workspaces are now scaled to 0 by the control plane and a
       * gateway catch-all serves their hostnames, so the OSS pod no longer
       * reads or acts on this column. Retained (no DROP migration) for
       * back-compat; safe to remove in a future migration.
       */
      state: text("state")
        .$type<"active" | "suspended" | "deleting">()
        .notNull()
        .default("active"),
      /**
       * Monotonic version bumped on every auth-instance-affecting write
       * (authConfig, ssoOidc, oauth toggles, platform credentials, tier
       * limits, config-file reconciler). Pods compare their cached auth
       * instance's recorded version against this value on each request and
       * call resetAuth() on mismatch — defense-in-depth backstop for the
       * Redis pub/sub invalidation channel `auth:config-invalidate`.
       *
       * Mutated only via atomic SQL `auth_config_version + 1` to avoid
       * lost-update on concurrent writes.
       */
      authConfigVersion: integer("auth_config_version").notNull().default(0),
    },
    (table) => [
      primaryKey({ columns: [table.workspaceId, table.id] }),
      unique().on(table.workspaceId, table.slug),
      workspacePolicy(table.workspaceId),
      unique().on(table.workspaceId),
    ],
  )
  .enableRLS();

/** Where identity may be read from, in resolver order. */
export type IdentitySource = "idToken" | "userinfo" | "accessTokenJwt";

/**
 * Profile fields a claim can be bound to. `username` has no column of its
 * own: it names the account when the provider sends no display name. `image`
 * is the avatar, read as an http(s) URL.
 */
export type ProfileField = "id" | "email" | "name" | "username" | "image";

/**
 * Role-mapping rules applied to an OIDC claim at sign-in. Now the `role`
 * section of {@link IdentityProviderClaimMapping}; the shape is unchanged from
 * the former `attribute_mapping` column so migrated rows behave identically.
 */
/** One role rule: when the claim contains a value, grant a role. */
export type ClaimRoleRule = {
  whenContains: string;
  role: "admin" | "member" | "user";
  /**
   * A workspace role (custom or preset) granted on top of the `member` tier,
   * the same way a custom-role invite or role change rides it. Only valid with
   * `role: 'member'`. A matched rule naming a role that no longer exists
   * grants nothing and leaves the person's role as it is.
   */
  roleId?: string;
};

export type ClaimRoleMapping = {
  /** Dotted path or namespaced claim on the ID token. */
  claimPath: string;
  /** First-match-wins role assignment from the resolved claim. */
  rules: ClaimRoleRule[];
  /** When true, every sign-in re-resolves and may demote/promote. */
  syncOnEverySignIn?: boolean;
};

/**
 * What this provider's claims mean, in one column with named sections.
 *
 * Replaces `attribute_mapping`, which despite its name only ever held the role
 * rules above. Profile-field mapping and user-attribute mapping both needed
 * somewhere to live, and a column each would have left three overlapping
 * mapping concepts on this table. Readers must tolerate partial and unknown
 * shapes — see `oidc-claim-mapping.ts` in the web app, which is the only place
 * this is interpreted.
 */
export type IdentityProviderClaimMapping = {
  /** Which claim carries the account id, the email, the display name, the
   *  username and the avatar. */
  profile?: {
    sources?: IdentitySource[];
    claims?: Partial<Record<ProfileField, string>>;
    /** Mint a placeholder address when the provider supplies no email. */
    allowMissingEmail?: boolean;
    /** Refresh the name and avatar from the provider on every sign-in. */
    syncOnSignIn?: boolean;
  };
  role?: ClaimRoleMapping;
  /** Claim to user-attribute copying. */
  attributes?: {
    map?: Array<{ claimPath: string; attributeKey: string }>;
    overrideExisting?: boolean;
    /** When true, a disappeared claim clears the stored attribute. */
    syncOnSignIn?: boolean;
  };
};

/** Why a captured identity source contributed no claims. */
export type SourceUnavailableReason = "absent" | "unreadable" | "fetch_failed";

/**
 * JSON-only snapshot of one identity source from an SSO test. Either a decoded
 * claims object or a closed reason the source could not be loaded.
 */
export type SourceSnapshot = {
  source: IdentitySource;
  claims?: Record<string, unknown>;
  unavailable?: SourceUnavailableReason;
};

/**
 * Identity provider — the single source of truth for an OIDC IdP.
 *
 * Consolidates the two legacy OIDC config models. `id` is the internal
 * TypeID FK target and never appears in URLs. `registrationId` is the
 * Better-Auth `providerId` string (`'sso'` / `'custom-oidc'` for
 * backfilled rows, `'oidc_<id>'` for net-new) — it drives the OAuth
 * redirect URI and `account.provider_id`, so it stays stable across the
 * migration. Discovery-doc installs leave the manual endpoint columns
 * null; manual installs leave `discoveryUrl` null.
 */
export type CapturedIdentity = {
  id: string;
  email?: string;
  name?: string;
  image?: string;
  sources: Partial<Record<"id" | "email" | "name" | "image", string>>;
  paths?: Partial<Record<"id" | "email" | "name" | "image", string>>;
};

/**
 * Stored SSO test capture. V1 rows omit `version`/`replay`. V2 rows set
 * `version: 2` and include source snapshots for exact replay.
 */
export type IdentityProviderTestCapture = {
  version?: 2;
  registrationId: string;
  capturedAt: string;
  detailsChangedAtAtStart?: string | null;
  outcome?: "success" | "mapping_failed";
  identity?: CapturedIdentity;
  claims: Record<string, unknown>;
  replay?: { sources: SourceSnapshot[] };
};

export type IdentityProviderTestCaptureV1 = IdentityProviderTestCapture & {
  identity: CapturedIdentity;
  version?: never;
  replay?: never;
};

export type IdentityProviderTestCaptureV2 = IdentityProviderTestCapture & {
  version: 2;
  detailsChangedAtAtStart: string | null;
  outcome: "success" | "mapping_failed";
  replay: { sources: SourceSnapshot[] };
};

/**
 * Verified SSO domains for the workspace.
 *
 * Each row pairs an email domain with the workspace's OIDC IdP:
 *  - `verified_at` null = pending DNS verification.
 *  - `verified_at` non-null = routes emails at this domain to SSO.
 *  - `enforced=true` = hard-binds emails at this domain to SSO (blocks
 *    password / magic-link / non-SSO OAuth).
 *
 * Single-workspace per deployment so no settings_id FK is needed. The
 * UNIQUE constraint on `name` keeps each domain on one row regardless
 * of pending/verified state.
 */

/**
 * Metadata for service principals (discriminated union by kind)
 */
export type ServiceMetadata =
  | { kind: "integration"; integrationType: string; integrationId?: string }
  | { kind: "api_key"; apiKeyId: string };

/**
 * Principal table - Unified identity for all actor types
 *
 * All actors have a principal record with a role:
 * - 'admin': Full administrative access, can manage settings and team
 * - 'member': Team member access, can manage feedback
 * - 'user': Portal user access only, can vote/comment on public portal
 *
 * Principal types:
 * - 'user': Identified customer human with a userId pointing to the user table
 * - 'anonymous': Unidentified visitor
 * - 'service': Integration or API key actor (userId is null)
 * - 'support': Cloud platform-support admin with a user row (can hold a session)
 *   that is not a customer human — omitted from seats, membership sync, and
 *   customer directories. Role still governs /admin privilege.
 *
 * The role determines access level: admin/member can access /admin dashboard,
 * while 'user' role can only interact with the public portal.
 */
export const principal = quillsSchema
  .table(
    "principal",
    {
      // Teammates use Kaneo identity; customer actors keep their customer userId.
      kaneoUserId: text("kaneo_user_id").references(() => userTable.id, {
        onDelete: "set null",
      }),
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("principal")("id").notNull(),
      // Nullable: null for service principals (API keys, integrations)
      userId: typeIdColumnNullable("user")("user_id"),
      // Unified roles: 'admin' | 'member' | 'user'
      // 'user' role = portal users (public portal access only, no admin dashboard)
      role: text("role").default("member").notNull(),
      // Principal type: 'user' | 'anonymous' | 'service' | 'support'
      type: text("type").default("user").notNull(),
      // Display name — always populated (humans synced from user.name, service principals set on creation)
      displayName: text("display_name"),
      // Avatar URL — OAuth/external avatar URLs (humans synced from user.image)
      avatarUrl: text("avatar_url"),
      // Avatar storage key — S3 key for uploaded avatars (humans synced from user.imageKey)
      avatarKey: text("avatar_key"),
      // Metadata for service principals (discriminated union by kind)
      serviceMetadata: jsonb(
        "service_metadata",
      ).$type<ServiceMetadata | null>(),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
      /**
       * Last time this principal completed an SSO sign-in (Better-Auth
       * generic-OAuth callback with providerId='sso' creating a new
       * session). Read by the SSO-enforcement bootstrap guard to refuse
       * enabling enforcement without a recent SSO sign-in window — stops
       * an admin who only signed in via magic-link from locking themselves
       * out. Null = never signed in via SSO. Written by the OIDC callback
       * hooks.after middleware (`/callback/:id`).
       */
      lastSsoSignInAt: timestamp("last_sso_sign_in_at", { withTimezone: true }),
      // A reachable address for a principal whose account email cannot receive
      // mail. Two populations arrive here:
      //   - an anonymous visitor, captured in the messenger by an agent, so an
      //     offline reply can reach them across conversations. Agent-only: the
      //     principal stays anonymous and this is never shown back to them.
      //   - a signed-in person whose identity provider released no address, so
      //     their account holds a minted placeholder. They supply this one
      //     themselves and confirm it by mail before it is written.
      // Delivery precedence lives in `resolveReplyRecipient`, which places this
      // above the per-conversation capture and below a real account email.
      contactEmail: text("contact_email"),
      // Manual agent availability override: 'online' (default — route chats to me)
      // vs 'away' (connected but opted out of routing). The presence TTL handles
      // auto-offline; this is the explicit opt-out, persisted across sessions.
      chatAvailability: text("chat_availability", { enum: ["online", "away"] })
        .notNull()
        .default("online"),
      // The B2B company this person belongs to (support platform §4.4). Soft-owned
      // FK: set null on company delete so people are never orphaned. Filled on
      // anonymous-to-identified merge via the contact_email rule (user wins,
      // source only fills a gap).
      companyId: typeIdColumnNullable("company")("company_id"),
      testOwnerPrincipalId: typeIdColumnNullable("principal")(
        "test_owner_principal_id",
      ),
      // Blocking (support platform §4.6). `blocked_at` = when the person was
      // blocked (null = not blocked, the enforcement flag); `blocked_by_principal_id`
      // = the team actor who blocked them. The FK is self-referential and set-null
      // so removing the actor never clears a live block on its own. Guards keep
      // team members and service principals from ever being blocked.
      blockedAt: timestamp("blocked_at", { withTimezone: true }),
      blockedByPrincipalId: typeIdColumnNullable("principal")(
        "blocked_by_principal_id",
      ),
    },
    (table) => [
      foreignKey({
        name: "principal_test_owner_principal_id_principal_id_fk",
        columns: [table.workspaceId, table.testOwnerPrincipalId],
        foreignColumns: [table.workspaceId, table.id],
      }).onDelete("cascade"),
      uniqueIndex("principal_test_owner_idx")
        .on(table.workspaceId, table.testOwnerPrincipalId)
        .where(sql`test_owner_principal_id IS NOT NULL`),
      // Self-referential blocking actor FK; named to match the SQL migration.
      foreignKey({
        name: "principal_blocked_by_principal_id_principal_id_fk",
        columns: [table.workspaceId, table.blockedByPrincipalId],
        foreignColumns: [table.workspaceId, table.id],
      }).onDelete("set null"),
      // Ensure one principal record per human user (partial index excludes service principals)
      uniqueIndex("principal_user_idx")
        .on(table.workspaceId, table.userId)
        .where(sql`user_id IS NOT NULL`),
      // Lookups by contact email (only the rows that have one).
      index("principal_contact_email_idx")
        .on(table.contactEmail)
        .where(sql`contact_email IS NOT NULL`),
      // Index for filtering by principal type
      index("principal_type_idx").on(table.type),
      // Composite index for user listings filtered by role, with or without a
      // date filter (e.g. portal users by join date)
      index("principal_role_created_at_idx").on(table.role, table.createdAt),
      // RI-lookup protection: principal deletion checks blocked_by references
      // against this table itself.
      index("principal_blocked_by_idx")
        .on(table.blockedByPrincipalId)
        .where(sql`"blocked_by_principal_id" IS NOT NULL`),
      // Case-insensitive prefix search for the @-mention typeahead;
      // text_pattern_ops lets the planner use it for LIKE 'prefix%'.
      index("principal_displayname_lower_idx").using(
        "btree",
        sql`lower(display_name) text_pattern_ops`,
      ),
      index("principal_display_name_trgm_idx")
        .using("gin", sql`${table.displayName} gin_trgm_ops`)
        .where(sql`${table.displayName} IS NOT NULL`),
      // Company -> people lookups (sidebar roster, member counts).
      index("principal_company_id_idx")
        .on(table.companyId)
        .where(sql`"company_id" IS NOT NULL`),
      check(
        "principal_identity_check",
        sql`num_nonnulls(${table.userId}, ${table.kaneoUserId}) <= 1`,
      ),
      unique().on(table.workspaceId, table.kaneoUserId),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.userId],
        foreignColumns: [user.workspaceId, user.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.workspaceId, table.companyId],
        foreignColumns: [companies.workspaceId, companies.id],
      }).onDelete("set null"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/**
 * JWKS table - JSON Web Key Sets for JWT signing/verification
 * Used by the jwt() plugin for token signing keys
 */

/**
 * OAuth Client table - Registered OAuth 2.1 clients (e.g., Claude Code, MCP clients)
 * Created via dynamic client registration or admin management
 */
export const oauthClient = quillsSchema
  .table(
    "oauth_client",
    {
      workspaceId: workspaceColumn(),
      id: text("id").notNull(),
      clientId: text("client_id").notNull(),
      clientSecret: text("client_secret"),
      disabled: boolean("disabled").default(false),
      skipConsent: boolean("skip_consent"),
      enableEndSession: boolean("enable_end_session"),
      scopes: text("scopes").array(),
      userId: typeIdColumn("user")("user_id"),
      createdAt: timestamp("created_at", { withTimezone: true }),
      updatedAt: timestamp("updated_at", { withTimezone: true }),
      // Client metadata
      name: text("name"),
      uri: text("uri"),
      icon: text("icon"),
      contacts: text("contacts").array(),
      tos: text("tos"),
      policy: text("policy"),
      softwareId: text("software_id"),
      softwareVersion: text("software_version"),
      softwareStatement: text("software_statement"),
      // OAuth configuration
      redirectUris: text("redirect_uris").array().notNull(),
      postLogoutRedirectUris: text("post_logout_redirect_uris").array(),
      tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
      grantTypes: text("grant_types").array(),
      responseTypes: text("response_types").array(),
      public: boolean("public"),
      type: text("type"),
      requirePKCE: boolean("require_pkce"),
      referenceId: text("reference_id"),
      metadata: jsonb("metadata"),
      // Better Auth 1.7 columns. `public` / `type` stay for expand-only rollback;
      // 1.7 reads `applicationType` and `tokenEndpointAuthMethod` instead.
      clientDiscoveryId: text("client_discovery_id"),
      subjectType: text("subject_type"),
      clientCredentialsScopes: text("client_credentials_scopes")
        .array()
        .default([]),
      backchannelLogoutUri: text("backchannel_logout_uri"),
      backchannelLogoutSessionRequired: boolean(
        "backchannel_logout_session_required",
      ),
      applicationType: text("application_type"),
      jwks: text("jwks"),
      jwksUri: text("jwks_uri"),
      dpopBoundAccessTokens: boolean("dpop_bound_access_tokens").default(false),
    },
    (table) => [
      primaryKey({ columns: [table.workspaceId, table.id] }),
      unique().on(table.workspaceId, table.clientId),
      foreignKey({
        columns: [table.workspaceId, table.userId],
        foreignColumns: [user.workspaceId, user.id],
      }).onDelete("cascade"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/**
 * OAuth Refresh Token table - Long-lived tokens for token refresh
 */

/**
 * OAuth Access Token table - Short-lived tokens for API access
 */

/**
 * OAuth Consent table - Records of user consent for OAuth client scopes
 */

/**
 * Protected resource the AS issues tokens for (RFC 8707). Seeded from
 * Better Auth 1.7 `resources` config.
 */

/**
 * Client ↔ resource linkage. Authoritative only when
 * `enforcePerClientResources` is true; we keep the flag off for DCR.
 */

/**
 * Single-use `private_key_jwt` client-assertion `jti` digest. Row id is the
 * digest; insert collision is the replay reject.
 */

/**
 * Device authorization grant (RFC 8628): a pending device sign-in, bound to the
 * OAuth client and resources it asked for. Written and consumed by Better
 * Auth's device-authorization plugin.
 */

// Relations for Drizzle relational queries (enables experimental joins)

// Settings is a singleton table in single-workspace mode, no relations needed

/**
 * Widget origin session marker table.
 *
 * Records sessions that were created via the widget OTT handoff route
 * (`/auth/widget-handoff?ott=...`). The portal access evaluator requires
 * a row here before granting the `widget` reason — prevents any
 * self-registered portal user from sneaking in via that grant branch.
 *
 * PK on session_id is the lookup key (one row per session at most).
 * Index on user_id supports cleanup of orphaned rows when a user's
 * sessions expire.
 */
export const widgetOriginSession = quillsSchema
  .table(
    "widget_origin_session",
    {
      workspaceId: workspaceColumn(),
      sessionId: text("session_id").notNull(),
      userId: text("user_id").notNull(),
      markedAt: timestamp("marked_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      index("widget_origin_session_user_id_idx").on(table.userId),
      primaryKey({ columns: [table.workspaceId, table.sessionId] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/**
 * Widget identification provenance table.
 *
 * Records, for each session minted by `/api/widget/identify`, whether
 * the identity claim was HMAC-verified (verified-token path) or
 * unverified (email-capture path). The handoff route reads this to
 * decide whether to insert a `widget_origin_session` marker — only
 * HMAC-verified sessions are allowed to upgrade into the widget
 * portal-access grant.
 *
 * Without this row, the portal gate would only know the workspace's
 * *current* `identifyVerificationEnabled` setting, not whether the
 * specific session was ever HMAC-verified — letting a session created
 * during an unverified window keep portal access after the admin turns
 * verification on, and letting any BA session that minted a generic
 * OTT walk through the handoff.
 *
 * Upsert semantics: re-identifying the same session demotes (or
 * promotes) hmac_verified to reflect the latest identify path. A
 * session that loses HMAC verification on re-identify must lose the
 * trust it carries.
 */
export const widgetIdentifiedSession = quillsSchema
  .table(
    "widget_identified_session",
    {
      workspaceId: workspaceColumn(),
      sessionId: text("session_id").notNull(),
      hmacVerified: boolean("hmac_verified").notNull(),
      identifiedAt: timestamp("identified_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      primaryKey({ columns: [table.workspaceId, table.sessionId] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

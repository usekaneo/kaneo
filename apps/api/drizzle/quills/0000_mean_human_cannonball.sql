CREATE SCHEMA "quills";
--> statement-breakpoint
CREATE TABLE "quills"."oauth_client" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" text NOT NULL,
	"client_id" text NOT NULL,
	"client_secret" text,
	"disabled" boolean DEFAULT false,
	"skip_consent" boolean,
	"enable_end_session" boolean,
	"scopes" text[],
	"user_id" uuid,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"name" text,
	"uri" text,
	"icon" text,
	"contacts" text[],
	"tos" text,
	"policy" text,
	"software_id" text,
	"software_version" text,
	"software_statement" text,
	"redirect_uris" text[] NOT NULL,
	"post_logout_redirect_uris" text[],
	"token_endpoint_auth_method" text,
	"grant_types" text[],
	"response_types" text[],
	"public" boolean,
	"type" text,
	"require_pkce" boolean,
	"reference_id" text,
	"metadata" jsonb,
	"client_discovery_id" text,
	"subject_type" text,
	"client_credentials_scopes" text[] DEFAULT '{}',
	"backchannel_logout_uri" text,
	"backchannel_logout_session_required" boolean,
	"application_type" text,
	"jwks" text,
	"jwks_uri" text,
	"dpop_bound_access_tokens" boolean DEFAULT false,
	CONSTRAINT "oauth_client_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "oauth_client_workspace_id_client_id_unique" UNIQUE("workspace_id","client_id")
);
--> statement-breakpoint
ALTER TABLE "quills"."oauth_client" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."principal" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"user_id" uuid,
	"role" text DEFAULT 'member' NOT NULL,
	"type" text DEFAULT 'user' NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"avatar_key" text,
	"service_metadata" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	"last_sso_sign_in_at" timestamp with time zone,
	"contact_email" text,
	"chat_availability" text DEFAULT 'online' NOT NULL,
	"company_id" uuid,
	"test_owner_principal_id" uuid,
	"blocked_at" timestamp with time zone,
	"blocked_by_principal_id" uuid,
	CONSTRAINT "principal_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."principal" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."settings" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_key" text,
	"favicon_key" text,
	"header_logo_key" text,
	"portal_og_image_key" text,
	"created_at" timestamp with time zone NOT NULL,
	"metadata" text,
	"auth_config" text,
	"portal_config" text,
	"branding_config" text,
	"custom_css" text,
	"developer_config" text,
	"header_display_mode" text DEFAULT 'logo_and_name',
	"header_display_name" text,
	"setup_state" text,
	"assistant_config" jsonb DEFAULT '{"version":4,"identity":{"name":"Quinn","avatarUrl":null},"agents":{"workspace":{"capabilities":{"qa":true},"knowledge":{"helpCenter":true,"posts":true,"pastConversations":true,"internalNotes":true,"tickets":true,"changelog":true,"documents":true,"status":true},"toolRules":{},"instructions":"","slack":{"enabled":false,"respondTo":"mentions_and_dms","allowUnlinkedPublicQa":false}},"agent":{"voice":{"tone":"balanced","responseLength":"balanced","additionalInstructions":""},"knowledge":{"helpCenter":true,"posts":false,"changelog":false,"documents":true,"status":false},"toolRules":{}},"copilot":{"capabilities":{"qa":true},"knowledge":{"helpCenter":true,"posts":true,"pastConversations":true,"internalNotes":true,"tickets":true,"changelog":true,"documents":true,"status":true},"toolRules":{}}}}'::jsonb NOT NULL,
	"assistant_config_revision" integer DEFAULT 1 NOT NULL,
	"widget_config" text,
	"widget_secret" text,
	"widget_installed_first_seen_at" timestamp with time zone,
	"widget_installed_last_seen_at" timestamp with time zone,
	"widget_installed_origin_host" text,
	"widget_installed_sdk_version" text,
	"feature_flags" text,
	"spam_filter_config" text,
	"help_center_config" text,
	"tier_limits" text,
	"cloud" jsonb,
	"cloud_revision" integer DEFAULT 0 NOT NULL,
	"cloud_identity" jsonb,
	"cloud_identity_revision" integer DEFAULT 0 NOT NULL,
	"managed_field_paths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"state" text DEFAULT 'active' NOT NULL,
	"auth_config_version" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "settings_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "settings_workspace_id_slug_unique" UNIQUE("workspace_id","slug"),
	CONSTRAINT "settings_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
ALTER TABLE "quills"."settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."customer_identity" (
	"kaneo_user_id" text,
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"image_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" text,
	"locale" text,
	"preferred_language" text,
	"country" text,
	"external_id" text,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	CONSTRAINT "customer_identity_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "customer_identity_workspace_id_kaneo_user_id_unique" UNIQUE("workspace_id","kaneo_user_id")
);
--> statement-breakpoint
ALTER TABLE "quills"."customer_identity" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."widget_identified_session" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"session_id" text NOT NULL,
	"hmac_verified" boolean NOT NULL,
	"identified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "widget_identified_session_workspace_id_session_id_pk" PRIMARY KEY("workspace_id","session_id")
);
--> statement-breakpoint
ALTER TABLE "quills"."widget_identified_session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."widget_origin_session" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"marked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "widget_origin_session_workspace_id_session_id_pk" PRIMARY KEY("workspace_id","session_id")
);
--> statement-breakpoint
ALTER TABLE "quills"."widget_origin_session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."permissions" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"key" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "permissions_workspace_id_key_unique" UNIQUE("workspace_id","key")
);
--> statement-breakpoint
ALTER TABLE "quills"."permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."principal_role_assignments" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"principal_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"team_id" uuid,
	"granted_by_principal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "principal_role_assignments_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."principal_role_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."role_permissions" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "role_permissions_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."role_permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."roles" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "roles_workspace_id_key_unique" UNIQUE("workspace_id","key")
);
--> statement-breakpoint
ALTER TABLE "quills"."roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."boards" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"access" jsonb DEFAULT '{"view":"anonymous","vote":"anonymous","submit":"anonymous","comment":"anonymous","segments":{"view":[],"vote":[],"submit":[],"comment":[]},"moderation":{"comments":"inherit","anonPosts":"inherit","signedPosts":"inherit"}}'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "boards_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "boards_workspace_id_slug_unique" UNIQUE("workspace_id","slug")
);
--> statement-breakpoint
ALTER TABLE "quills"."boards" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."post_tags" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6b7280' NOT NULL,
	"description" text,
	"ai_prompt" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "post_tags_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "post_tags_workspace_id_name_unique" UNIQUE("workspace_id","name")
);
--> statement-breakpoint
ALTER TABLE "quills"."post_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."roadmap_columns" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"roadmap_id" uuid NOT NULL,
	"status_id" uuid NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"color" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roadmap_columns_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."roadmap_columns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."roadmaps" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'column' NOT NULL,
	"base_filter" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"date_source" text,
	"frequency" text,
	"visibility" text DEFAULT 'public' NOT NULL,
	"visible_segment_ids" jsonb,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "roadmaps_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "roadmaps_workspace_id_slug_unique" UNIQUE("workspace_id","slug"),
	CONSTRAINT "roadmaps_type_check" CHECK ("quills"."roadmaps"."type" IN ('column', 'date')),
	CONSTRAINT "roadmaps_date_source_check" CHECK ("quills"."roadmaps"."date_source" IS NULL OR "quills"."roadmaps"."date_source" = 'eta'),
	CONSTRAINT "roadmaps_frequency_check" CHECK ("quills"."roadmaps"."frequency" IS NULL OR "quills"."roadmaps"."frequency" IN ('monthly', 'quarterly', 'semiannual')),
	CONSTRAINT "roadmaps_visibility_check" CHECK ("quills"."roadmaps"."visibility" IN ('public', 'team', 'segment')),
	CONSTRAINT "roadmaps_base_filter_object_check" CHECK (jsonb_typeof("quills"."roadmaps"."base_filter") = 'object'),
	CONSTRAINT "roadmaps_visible_segment_ids_array_check" CHECK ("quills"."roadmaps"."visible_segment_ids" IS NULL OR jsonb_typeof("quills"."roadmaps"."visible_segment_ids") = 'array'),
	CONSTRAINT "roadmaps_type_config_check" CHECK ((
        ("quills"."roadmaps"."type" = 'column' AND "quills"."roadmaps"."date_source" IS NULL AND "quills"."roadmaps"."frequency" IS NULL)
        OR
        ("quills"."roadmaps"."type" = 'date' AND "quills"."roadmaps"."date_source" = 'eta' AND "quills"."roadmaps"."frequency" IS NOT NULL)
      ))
);
--> statement-breakpoint
ALTER TABLE "quills"."roadmaps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."post_statuses" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"color" text DEFAULT '#6b7280' NOT NULL,
	"category" text DEFAULT 'active' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"show_on_roadmap" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "post_statuses_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "post_statuses_workspace_id_slug_unique" UNIQUE("workspace_id","slug")
);
--> statement-breakpoint
ALTER TABLE "quills"."post_statuses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."post_comment_edit_history" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"comment_id" uuid NOT NULL,
	"editor_principal_id" uuid NOT NULL,
	"previous_content" text NOT NULL,
	"previous_content_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_comment_edit_history_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."post_comment_edit_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."post_comment_reactions" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"comment_id" uuid NOT NULL,
	"principal_id" uuid NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_comment_reactions_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."post_comment_reactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."post_comments" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"parent_id" uuid,
	"principal_id" uuid NOT NULL,
	"content" text NOT NULL,
	"content_json" jsonb,
	"is_team_member" boolean DEFAULT false NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"status_change_from_id" uuid,
	"status_change_to_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_by_principal_id" uuid,
	"moderation_state" text DEFAULT 'published' NOT NULL,
	CONSTRAINT "post_comments_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."post_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."post_edit_history" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"editor_principal_id" uuid NOT NULL,
	"previous_title" text NOT NULL,
	"previous_content" text NOT NULL,
	"previous_content_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_edit_history_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."post_edit_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."post_notes" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"principal_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_notes_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."post_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."post_tag_assignments" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"post_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"auto_tagged" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quills"."post_tag_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."post_votes" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"principal_id" uuid NOT NULL,
	"source_type" varchar(40),
	"source_external_url" text,
	"added_by_principal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_votes_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."post_votes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."posts" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"board_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"content_json" jsonb,
	"principal_id" uuid NOT NULL,
	"status_id" uuid,
	"owner_principal_id" uuid,
	"tracked_by_principal_id" uuid,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"pinned_comment_id" uuid,
	"pinned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by_principal_id" uuid,
	"is_comments_locked" boolean DEFAULT false NOT NULL,
	"moderation_state" text DEFAULT 'published' NOT NULL,
	"widget_metadata" jsonb,
	"custom_field_values" jsonb,
	"canonical_post_id" uuid,
	"merged_at" timestamp with time zone,
	"merged_by_principal_id" uuid,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(content, '')), 'B')) STORED,
	"embedding" vector(1536),
	"embedding_model" text,
	"embedding_updated_at" timestamp with time zone,
	"summary_json" jsonb,
	"summary_model" text,
	"summary_updated_at" timestamp with time zone,
	"summary_comment_count" integer,
	"merge_checked_at" timestamp with time zone,
	"eta" timestamp with time zone,
	CONSTRAINT "posts_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "vote_count_non_negative" CHECK (vote_count >= 0),
	CONSTRAINT "comment_count_non_negative" CHECK (comment_count >= 0)
);
--> statement-breakpoint
ALTER TABLE "quills"."posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."companies" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"external_id" text,
	"plan" text,
	"mrr_cents" integer,
	"size" text,
	"website" text,
	"industry" text,
	"source" text DEFAULT 'api' NOT NULL,
	"custom_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."companies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."company_attribute_definitions" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"currency_code" text,
	"external_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_attribute_definitions_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."company_attribute_definitions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."post_mentions" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"principal_id" uuid NOT NULL,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_mentions_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."post_mentions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."post_views" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"filters" jsonb NOT NULL,
	"created_by_principal_id" uuid,
	"is_shared" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "post_views_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."post_views" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."integration_event_mappings" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"action_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"filters" jsonb,
	"target_key" varchar(100) DEFAULT 'default' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_event_mappings_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "mapping_unique" UNIQUE("workspace_id","action_type","event_type","integration_id","target_key")
);
--> statement-breakpoint
ALTER TABLE "quills"."integration_event_mappings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."integration_platform_credentials" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"integration_type" varchar(50) NOT NULL,
	"secrets" text NOT NULL,
	"configured_by_principal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_platform_credentials_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "platform_cred_type_unique" UNIQUE("workspace_id","integration_type")
);
--> statement-breakpoint
ALTER TABLE "quills"."integration_platform_credentials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."integrations" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"integration_type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"secrets" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"connected_by_principal_id" uuid,
	"principal_id" uuid,
	"connected_at" timestamp with time zone,
	"last_sync_at" timestamp with time zone,
	"last_error" text,
	"last_error_at" timestamp with time zone,
	"error_count" integer DEFAULT 0 NOT NULL,
	"last_outbound_at" timestamp with time zone,
	"last_inbound_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integrations_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "integration_type_unique" UNIQUE("workspace_id","integration_type"),
	CONSTRAINT "error_count_non_negative" CHECK (error_count >= 0)
);
--> statement-breakpoint
ALTER TABLE "quills"."integrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."changelog_entries" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"content_json" jsonb,
	"principal_id" uuid,
	"published_at" timestamp with time zone,
	"display_date" timestamp with time zone,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"featured_image_url" text,
	"segment_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"embedding" vector(1536),
	"embedding_model" text,
	"embedding_updated_at" timestamp with time zone,
	CONSTRAINT "changelog_entries_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."changelog_entries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."changelog_entry_posts" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"changelog_entry_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quills"."changelog_entry_posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."changelog_categories" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"segment_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "changelog_categories_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."changelog_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."changelog_entry_categories" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"changelog_entry_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "changelog_entry_categories_pk" PRIMARY KEY("workspace_id","category_id","changelog_entry_id")
);
--> statement-breakpoint
ALTER TABLE "quills"."changelog_entry_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."changelog_subscriptions" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"principal_id" uuid NOT NULL,
	"source" text NOT NULL,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "changelog_subscriptions_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."changelog_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."status_component_events" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"status" text NOT NULL,
	"source" text NOT NULL,
	"incident_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "status_component_events_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."status_component_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."status_component_groups" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"collapsed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "status_component_groups_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."status_component_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."status_components" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"group_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'operational' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"show_uptime" boolean DEFAULT true NOT NULL,
	"segment_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "status_components_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."status_components" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."status_incident_components" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"incident_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"component_status" text NOT NULL,
	CONSTRAINT "status_incident_components_incident_id_component_id_pk" PRIMARY KEY("workspace_id","component_id","incident_id")
);
--> statement-breakpoint
ALTER TABLE "quills"."status_incident_components" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."status_incident_templates" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"impact" text DEFAULT 'minor' NOT NULL,
	"component_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "status_incident_templates_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."status_incident_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."status_incident_updates" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"incident_id" uuid NOT NULL,
	"status" text NOT NULL,
	"body" text NOT NULL,
	"created_by" uuid,
	"template_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "status_incident_updates_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."status_incident_updates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."status_incidents" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"impact" text DEFAULT 'none' NOT NULL,
	"impact_override" boolean DEFAULT false NOT NULL,
	"scheduled_start_at" timestamp with time zone,
	"scheduled_end_at" timestamp with time zone,
	"auto_start" boolean DEFAULT true NOT NULL,
	"auto_complete" boolean DEFAULT true NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"backfilled" boolean DEFAULT false NOT NULL,
	"notified_at" timestamp with time zone,
	"notify_subscribers" boolean DEFAULT true NOT NULL,
	"details_edited_at" timestamp with time zone,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "status_incidents_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."status_incidents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."status_subscriptions" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"principal_id" uuid NOT NULL,
	"scope" text DEFAULT 'page' NOT NULL,
	"component_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text NOT NULL,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "status_subscriptions_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."status_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."conversation_message_flags" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"conversation_message_id" uuid NOT NULL,
	"principal_id" uuid NOT NULL,
	"flagged_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_message_flags_pkey" PRIMARY KEY("workspace_id","conversation_message_id","principal_id")
);
--> statement-breakpoint
ALTER TABLE "quills"."conversation_message_flags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."conversation_message_mentions" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"conversation_message_id" uuid NOT NULL,
	"principal_id" uuid NOT NULL,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_message_mentions_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."conversation_message_mentions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."conversation_message_reactions" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"conversation_message_id" uuid NOT NULL,
	"principal_id" uuid NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_message_reactions_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."conversation_message_reactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."conversation_message_translations" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"conversation_message_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_message_translations_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."conversation_message_translations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."conversation_messages" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"conversation_id" uuid,
	"ticket_id" uuid,
	"workspace_thread_key" text,
	"principal_id" uuid,
	"sender_type" text NOT NULL,
	"content" text NOT NULL,
	"content_json" jsonb,
	"is_internal" boolean DEFAULT false NOT NULL,
	"attachments" jsonb,
	"citations" jsonb,
	"metadata" jsonb,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_by_principal_id" uuid,
	CONSTRAINT "conversation_messages_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "conversation_messages_parent_check" CHECK (num_nonnulls("quills"."conversation_messages"."conversation_id", "quills"."conversation_messages"."ticket_id", "quills"."conversation_messages"."workspace_thread_key") = 1),
	CONSTRAINT "conversation_messages_workspace_internal_check" CHECK ("quills"."conversation_messages"."workspace_thread_key" IS NULL OR "quills"."conversation_messages"."is_internal" = true)
);
--> statement-breakpoint
ALTER TABLE "quills"."conversation_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."conversation_participants" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"conversation_id" uuid NOT NULL,
	"principal_id" uuid NOT NULL,
	"added_by_principal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quills"."conversation_participants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."conversation_tag_assignments" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"conversation_id" uuid NOT NULL,
	"conversation_tag_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quills"."conversation_tag_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."conversation_tags" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6b7280' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "conversation_tags_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "conversation_tags_workspace_id_name_unique" UNIQUE("workspace_id","name")
);
--> statement-breakpoint
ALTER TABLE "quills"."conversation_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."conversations" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"visitor_principal_id" uuid NOT NULL,
	"assigned_agent_principal_id" uuid,
	"assigned_team_id" uuid,
	"status" text DEFAULT 'open' NOT NULL,
	"snoozed_until" timestamp with time zone,
	"waiting_since" timestamp with time zone,
	"source" text DEFAULT 'widget' NOT NULL,
	"custom_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"channel" text NOT NULL,
	"priority" text DEFAULT 'none' NOT NULL,
	"subject" text,
	"last_message_preview" text,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"visitor_last_read_at" timestamp with time zone,
	"agent_last_read_at" timestamp with time zone,
	"csat_rating" integer,
	"csat_comment" text,
	"csat_submitted_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"end_reason" text,
	"end_note" text,
	"spam_reason" text,
	"visitor_email" text,
	"channel_account_id" uuid,
	"sla_applied" jsonb,
	"detected_customer_language" text,
	"translation_enabled" boolean DEFAULT false NOT NULL,
	"translation_dismissed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "conversations_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."conversation_summaries" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"visitor_principal_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"embedding" vector(1536),
	"embedding_model" text,
	"embedding_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_summaries_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "conversation_summaries_workspace_id_conversation_id_unique" UNIQUE("workspace_id","conversation_id")
);
--> statement-breakpoint
ALTER TABLE "quills"."conversation_summaries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."conversation_view_pins" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"principal_id" uuid NOT NULL,
	"view_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_view_pins_pkey" PRIMARY KEY("workspace_id","principal_id","view_id")
);
--> statement-breakpoint
ALTER TABLE "quills"."conversation_view_pins" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."conversation_views" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"filters" jsonb NOT NULL,
	"sort" text,
	"created_by_principal_id" uuid,
	"is_shared" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "conversation_views_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."conversation_views" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."conversation_attribute_definitions" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"field_type" text NOT NULL,
	"options" jsonb,
	"required_to_close" boolean DEFAULT false NOT NULL,
	"source_hint" text,
	"ai_detect" boolean DEFAULT false NOT NULL,
	"detect_on_close" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_attribute_definitions_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."conversation_attribute_definitions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."team_members" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"principal_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."team_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."teams" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"color" text,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"assignment_method" text DEFAULT 'manual' NOT NULL,
	"rr_cursor_principal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "teams_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."ticket_conversations" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"ticket_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"ticket_type" text NOT NULL,
	"linked_by_principal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_conversations_pkey" PRIMARY KEY("workspace_id","conversation_id","ticket_id")
);
--> statement-breakpoint
ALTER TABLE "quills"."ticket_conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."ticket_links" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"tracker_ticket_id" uuid NOT NULL,
	"linked_ticket_id" uuid NOT NULL,
	"relation" text DEFAULT 'tracks' NOT NULL,
	"linked_by_principal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_links_pkey" PRIMARY KEY("workspace_id","linked_ticket_id","tracker_ticket_id")
);
--> statement-breakpoint
ALTER TABLE "quills"."ticket_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."ticket_statuses" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"color" text DEFAULT '#6b7280' NOT NULL,
	"category" text DEFAULT 'open' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"public_stage" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "ticket_statuses_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "ticket_statuses_workspace_id_slug_unique" UNIQUE("workspace_id","slug")
);
--> statement-breakpoint
ALTER TABLE "quills"."ticket_statuses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."tickets" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"number" bigserial NOT NULL,
	"type" text DEFAULT 'customer' NOT NULL,
	"ticket_type_id" uuid,
	"title" text NOT NULL,
	"status_id" uuid NOT NULL,
	"priority" text DEFAULT 'none' NOT NULL,
	"requester_principal_id" uuid,
	"assignee_principal_id" uuid,
	"assignee_team_id" uuid,
	"company_id" uuid,
	"custom_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"first_response_at" timestamp with time zone,
	"waiting_since" timestamp with time zone,
	"due_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"reopened_count" integer DEFAULT 0 NOT NULL,
	"requester_last_read_at" timestamp with time zone,
	"assignee_last_read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sla_applied" jsonb,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tickets_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."tickets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."ticket_types" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"category" text NOT NULL,
	"icon" text,
	"color" text DEFAULT '#6b7280' NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"intake_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "ticket_types_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "ticket_types_workspace_id_slug_unique" UNIQUE("workspace_id","slug")
);
--> statement-breakpoint
ALTER TABLE "quills"."ticket_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."ticket_summaries" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"requester_principal_id" uuid,
	"summary" text NOT NULL,
	"embedding" vector(1536),
	"embedding_model" text,
	"embedding_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_summaries_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "ticket_summaries_workspace_id_ticket_id_unique" UNIQUE("workspace_id","ticket_id")
);
--> statement-breakpoint
ALTER TABLE "quills"."ticket_summaries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."ticket_subscriptions" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"principal_id" uuid NOT NULL,
	"reason" varchar(20) NOT NULL,
	"muted_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_subscriptions_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."ticket_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."ticket_activity" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"principal_id" uuid,
	"type" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_activity_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."ticket_activity" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."channel_accounts" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"owning_team_id" uuid NOT NULL,
	"channel" text DEFAULT 'email' NOT NULL,
	"role" text NOT NULL,
	"address" text,
	"module" text,
	"sending_domain_id" uuid,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"inbound_trust" text DEFAULT 'strict' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "channel_accounts_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "channel_accounts_role_check" CHECK ("quills"."channel_accounts"."role" IN ('inbound','sending','connection'))
);
--> statement-breakpoint
ALTER TABLE "quills"."channel_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."email_sending_domains" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"owning_team_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"dns_records" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verified_at" timestamp with time zone,
	"dkim_mode" text DEFAULT 'easy' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"mail_from_label" text DEFAULT 'bounce' NOT NULL,
	"auto_check_until" timestamp with time zone,
	"preflight" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pending_signing_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_sending_domains_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."email_sending_domains" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."email_ses_tenants" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"tenant_name" text NOT NULL,
	"tenant_arn" text,
	"associated_arns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"from_domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"configuration_set" text,
	"ready_at" timestamp with time zone,
	"sending_status" text,
	"status_cause" text,
	"status_checked_at" timestamp with time zone,
	"paused_notified_at" timestamp with time zone,
	"reconciled_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_ses_tenants_workspace_id_tenant_name_pk" PRIMARY KEY("workspace_id","tenant_name")
);
--> statement-breakpoint
ALTER TABLE "quills"."email_ses_tenants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."channel_threads" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"channel_account_id" uuid NOT NULL,
	"external_thread_key" text NOT NULL,
	"conversation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_threads_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."channel_threads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."office_hours_schedules" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"name" text DEFAULT 'Default' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"intervals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"holidays" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "office_hours_schedules_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."office_hours_schedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."sla_events" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"conversation_id" uuid,
	"ticket_id" uuid,
	"policy_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sla_events_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "sla_events_subject_check" CHECK ("quills"."sla_events"."conversation_id" IS NOT NULL OR "quills"."sla_events"."ticket_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "quills"."sla_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."sla_policies" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"first_response_target_secs" integer,
	"next_response_target_secs" integer,
	"time_to_close_target_secs" integer,
	"time_to_resolve_target_secs" integer,
	"pause_on_snooze" boolean DEFAULT true NOT NULL,
	"pause_on_pending" boolean DEFAULT true NOT NULL,
	"office_hours_schedule_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "sla_policies_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."sla_policies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."workflow_run_events" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"workflow_id" uuid NOT NULL,
	"subject_principal_id" uuid,
	"kind" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_run_events_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."workflow_run_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."workflow_runs" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"workflow_id" uuid NOT NULL,
	"conversation_id" uuid,
	"subject_principal_id" uuid,
	"state" text DEFAULT 'running' NOT NULL,
	"customer_facing" boolean DEFAULT false NOT NULL,
	"cursor" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"graph" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "workflow_runs_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."workflow_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."workflow_versions" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"workflow_id" uuid NOT NULL,
	"name" text NOT NULL,
	"trigger_type" text NOT NULL,
	"trigger_settings" jsonb NOT NULL,
	"graph" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_versions_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."workflow_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."workflows" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"class" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"trigger_type" text NOT NULL,
	"trigger_settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"graph" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "workflows_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."workflows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."channel_identities" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"channel" text NOT NULL,
	"external_id" text NOT NULL,
	"principal_id" uuid NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_identities_pkey" PRIMARY KEY("workspace_id","channel","external_id")
);
--> statement-breakpoint
ALTER TABLE "quills"."channel_identities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."conversation_outbound_emails" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"message_id" text NOT NULL,
	"conversation_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_outbound_emails_workspace_id_message_id_pk" PRIMARY KEY("workspace_id","message_id")
);
--> statement-breakpoint
ALTER TABLE "quills"."conversation_outbound_emails" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."in_app_notifications" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"principal_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text,
	"post_id" uuid,
	"comment_id" uuid,
	"metadata" jsonb,
	"read_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "in_app_notifications_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."in_app_notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."notification_preferences" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"principal_id" uuid NOT NULL,
	"email_status_change" boolean DEFAULT true NOT NULL,
	"email_new_comment" boolean DEFAULT true NOT NULL,
	"email_muted" boolean DEFAULT false NOT NULL,
	"matrix" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "notification_preferences_workspace_id_principal_id_unique" UNIQUE("workspace_id","principal_id")
);
--> statement-breakpoint
ALTER TABLE "quills"."notification_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."post_subscriptions" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"principal_id" uuid NOT NULL,
	"reason" varchar(20) NOT NULL,
	"notify_comments" boolean DEFAULT true NOT NULL,
	"notify_status_changes" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_subscriptions_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."post_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."unsubscribe_tokens" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"token" text NOT NULL,
	"principal_id" uuid NOT NULL,
	"post_id" uuid,
	"action" varchar(30) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unsubscribe_tokens_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "unsubscribe_tokens_workspace_id_token_unique" UNIQUE("workspace_id","token")
);
--> statement-breakpoint
ALTER TABLE "quills"."unsubscribe_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."post_sentiment" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"sentiment" text NOT NULL,
	"confidence" real NOT NULL,
	"model" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	CONSTRAINT "post_sentiment_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "post_sentiment_workspace_id_post_id_unique" UNIQUE("workspace_id","post_id")
);
--> statement-breakpoint
ALTER TABLE "quills"."post_sentiment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."api_keys" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"key_prefix" varchar(12) NOT NULL,
	"created_by_id" uuid,
	"principal_id" uuid NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"scopes" text,
	"kind" text DEFAULT 'personal' NOT NULL,
	CONSTRAINT "api_keys_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "api_keys_workspace_id_key_hash_unique" UNIQUE("workspace_id","key_hash"),
	CONSTRAINT "api_keys_kind_check" CHECK ("quills"."api_keys"."kind" IN ('personal', 'workspace'))
);
--> statement-breakpoint
ALTER TABLE "quills"."api_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."webhooks" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"events" text[] NOT NULL,
	"board_ids" text[],
	"status" text DEFAULT 'active' NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"last_triggered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "webhooks_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."webhooks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."post_external_links" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"integration_id" uuid,
	"integration_type" varchar(50) NOT NULL,
	"external_id" text NOT NULL,
	"sync_scope" text DEFAULT '' NOT NULL,
	"external_display_id" text,
	"external_url" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"remote_title" text,
	"remote_state" varchar(64),
	"remote_state_at" timestamp with time zone,
	"origin" varchar(20),
	"created_by_principal_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_external_links_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "post_external_links_type_external_post_unique" UNIQUE("workspace_id","external_id","integration_type","post_id","sync_scope")
);
--> statement-breakpoint
ALTER TABLE "quills"."post_external_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."ticket_external_links" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"integration_id" uuid,
	"integration_type" varchar(50) NOT NULL,
	"external_id" text NOT NULL,
	"sync_scope" text DEFAULT '' NOT NULL,
	"external_display_id" text,
	"external_url" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"remote_title" text,
	"remote_state" varchar(64),
	"remote_state_at" timestamp with time zone,
	"origin" varchar(20),
	"created_by_principal_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticket_external_links_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "ticket_external_links_type_external_ticket_unique" UNIQUE("workspace_id","external_id","integration_type","sync_scope","ticket_id")
);
--> statement-breakpoint
ALTER TABLE "quills"."ticket_external_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."segments" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'manual' NOT NULL,
	"color" text DEFAULT '#6b7280' NOT NULL,
	"rules" jsonb,
	"evaluation_schedule" jsonb,
	"weight_config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "segments_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."segments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."user_segments" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"principal_id" uuid NOT NULL,
	"segment_id" uuid NOT NULL,
	"added_by" text DEFAULT 'manual' NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_segments_added_by_check" CHECK (added_by = ANY (ARRAY['manual'::text, 'dynamic'::text, 'sso'::text, 'widget'::text, 'api'::text]))
);
--> statement-breakpoint
ALTER TABLE "quills"."user_segments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."user_attribute_definitions" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"currency_code" text,
	"external_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_attribute_definitions_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."user_attribute_definitions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."user_tag_assignments" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"principal_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quills"."user_tag_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."user_tags" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6b7280' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "user_tags_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "user_tags_workspace_id_name_unique" UNIQUE("workspace_id","name")
);
--> statement-breakpoint
ALTER TABLE "quills"."user_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."post_merge_suggestions" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"source_post_id" uuid NOT NULL,
	"target_post_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"vector_score" real NOT NULL,
	"fts_score" real NOT NULL,
	"hybrid_score" real NOT NULL,
	"llm_confidence" real NOT NULL,
	"llm_reasoning" text,
	"llm_model" text,
	"resolved_at" timestamp with time zone,
	"resolved_by_principal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_merge_suggestions_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."post_merge_suggestions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."post_activity" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"principal_id" uuid,
	"type" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_activity_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."post_activity" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."ai_usage_log" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"pipeline_step" varchar(30) NOT NULL,
	"call_type" varchar(20) NOT NULL,
	"model" varchar(100) NOT NULL,
	"raw_feedback_item_id" uuid,
	"signal_id" uuid,
	"post_id" uuid,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(10) DEFAULT 'success' NOT NULL,
	"error" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_usage_log_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."ai_usage_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."email_log" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"direction" varchar(16) NOT NULL,
	"email_type" varchar(64) NOT NULL,
	"provider" varchar(32),
	"message_id" text,
	"provider_message_id" text,
	"principal_id" uuid,
	"address" text NOT NULL,
	"subject" text,
	"conversation_id" uuid,
	"ticket_id" uuid,
	"post_id" uuid,
	"status" varchar(16) NOT NULL,
	"error" text,
	"billable" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_log_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."email_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."kb_article_feedback" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"principal_id" uuid,
	"helpful" boolean NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kb_article_feedback_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."kb_article_feedback" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."kb_article_translations" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"description" text,
	"content" text DEFAULT '' NOT NULL,
	"content_json" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector(CASE locale WHEN 'de' THEN 'german'::regconfig WHEN 'fr' THEN 'french'::regconfig WHEN 'es' THEN 'spanish'::regconfig WHEN 'ar' THEN 'arabic'::regconfig WHEN 'ru' THEN 'russian'::regconfig WHEN 'nl' THEN 'dutch'::regconfig WHEN 'pt-br' THEN 'portuguese'::regconfig WHEN 'zh-cn' THEN 'simple'::regconfig WHEN 'zh-tw' THEN 'simple'::regconfig ELSE 'english'::regconfig END, coalesce(title, '')), 'A') || setweight(to_tsvector(CASE locale WHEN 'de' THEN 'german'::regconfig WHEN 'fr' THEN 'french'::regconfig WHEN 'es' THEN 'spanish'::regconfig WHEN 'ar' THEN 'arabic'::regconfig WHEN 'ru' THEN 'russian'::regconfig WHEN 'nl' THEN 'dutch'::regconfig WHEN 'pt-br' THEN 'portuguese'::regconfig WHEN 'zh-cn' THEN 'simple'::regconfig WHEN 'zh-tw' THEN 'simple'::regconfig ELSE 'english'::regconfig END, coalesce(content, '')), 'B')) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kb_article_translations_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."kb_article_translations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."kb_articles" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"position" integer,
	"content" text NOT NULL,
	"content_json" jsonb,
	"principal_id" uuid NOT NULL,
	"published_at" timestamp with time zone,
	"segment_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"not_helpful_count" integer DEFAULT 0 NOT NULL,
	"url_id" integer GENERATED BY DEFAULT AS IDENTITY (sequence name "quills"."kb_articles_url_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(content, '')), 'B')) STORED,
	"embedding" vector(1536),
	"embedding_model" text,
	"embedding_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "kb_articles_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."kb_articles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."kb_categories" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"parent_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"segment_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"url_id" integer GENERATED BY DEFAULT AS IDENTITY (sequence name "quills"."kb_categories_url_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "kb_categories_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."kb_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."kb_category_translations" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kb_category_translations_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."kb_category_translations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."hc_redirect_rules" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"path" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hc_redirect_rules_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."hc_redirect_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."kb_search_queries" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"normalized_query" text NOT NULL,
	"locale" text NOT NULL,
	"results_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kb_search_queries_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."kb_search_queries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."analytics_daily_stats" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"date" date NOT NULL,
	"new_posts" integer DEFAULT 0 NOT NULL,
	"new_votes" integer DEFAULT 0 NOT NULL,
	"new_comments" integer DEFAULT 0 NOT NULL,
	"new_users" integer DEFAULT 0 NOT NULL,
	"posts_by_status" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"posts_by_board" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"posts_by_source" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analytics_daily_stats_workspace_id_date_pk" PRIMARY KEY("workspace_id","date")
);
--> statement-breakpoint
ALTER TABLE "quills"."analytics_daily_stats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."analytics_top_posts" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"period" text NOT NULL,
	"rank" integer NOT NULL,
	"post_id" uuid NOT NULL,
	"title" text NOT NULL,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"board_name" text,
	"status_name" text,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "analytics_top_posts_workspace_id_period_rank_pk" PRIMARY KEY("workspace_id","period","rank")
);
--> statement-breakpoint
ALTER TABLE "quills"."analytics_top_posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."page_views" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"site_origin" text NOT NULL,
	"surface" text NOT NULL,
	"path" text NOT NULL,
	"source" text,
	"country" text,
	"device" text,
	"browser" text,
	"os" text,
	"visitor_hash" text NOT NULL,
	"device_id" text,
	"principal_id" uuid,
	CONSTRAINT "page_views_pkey" PRIMARY KEY("workspace_id","occurred_at","id")
) PARTITION BY RANGE ("occurred_at");
--> statement-breakpoint
ALTER TABLE "quills"."page_views" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."visitor_devices" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"device_id" text NOT NULL,
	"principal_id" uuid,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_country" text,
	CONSTRAINT "visitor_devices_workspace_id_device_id_pk" PRIMARY KEY("workspace_id","device_id")
);
--> statement-breakpoint
ALTER TABLE "quills"."visitor_devices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."visitor_stats_daily" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"date" date NOT NULL,
	"surface" text NOT NULL,
	"unique_visitors" integer DEFAULT 0 NOT NULL,
	"pageviews" integer DEFAULT 0 NOT NULL,
	"visits" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visitor_stats_daily_pkey" PRIMARY KEY("workspace_id","date","surface")
);
--> statement-breakpoint
ALTER TABLE "quills"."visitor_stats_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."visitor_top_stats" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"period" text NOT NULL,
	"surface" text NOT NULL,
	"dimension" text NOT NULL,
	"rank" integer NOT NULL,
	"label" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visitor_top_stats_pkey" PRIMARY KEY("workspace_id","dimension","period","rank","surface")
);
--> statement-breakpoint
ALTER TABLE "quills"."visitor_top_stats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."hook_deliveries" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"job_id" text NOT NULL,
	"hook_type" text NOT NULL,
	"outcome" text DEFAULT 'completed' NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hook_deliveries_workspace_id_job_id_pk" PRIMARY KEY("workspace_id","job_id")
);
--> statement-breakpoint
ALTER TABLE "quills"."hook_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."events" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" bigint GENERATED ALWAYS AS IDENTITY (sequence name "quills"."events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"payload" jsonb NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"schema_version" smallint DEFAULT 1 NOT NULL,
	"dedupe_key" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"dispatch_owner" text DEFAULT 'job' NOT NULL,
	CONSTRAINT "events_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."job_queue" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" bigint GENERATED ALWAYS AS IDENTITY (sequence name "quills"."job_queue_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"job_id" text NOT NULL,
	"queue" text NOT NULL,
	"dedupe_key" text,
	"workspace_key" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 1 NOT NULL,
	"lease_token" uuid,
	"locked_until" timestamp with time zone,
	"locked_by" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "job_queue_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "job_queue_status_check" CHECK ("quills"."job_queue"."status" IN ('pending', 'running', 'succeeded', 'failed')),
	CONSTRAINT "job_queue_max_attempts_check" CHECK ("quills"."job_queue"."max_attempts" >= 1),
	CONSTRAINT "job_queue_lease_shape_check" CHECK (("quills"."job_queue"."status" = 'running') = ("quills"."job_queue"."lease_token" IS NOT NULL AND "quills"."job_queue"."locked_until" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "quills"."job_queue" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."kv_set_member" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"workspace_key" text NOT NULL,
	"set_key" text NOT NULL,
	"member" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "kv_set_member_workspace_id_workspace_key_set_key_member_pk" PRIMARY KEY("workspace_id","workspace_key","set_key","member")
);
--> statement-breakpoint
ALTER TABLE "quills"."kv_set_member" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."kv_store" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"workspace_key" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "kv_store_workspace_id_workspace_key_key_pk" PRIMARY KEY("workspace_id","workspace_key","key")
);
--> statement-breakpoint
ALTER TABLE "quills"."kv_store" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."presence_stream" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"workspace_key" text NOT NULL,
	"principal_id" text NOT NULL,
	"stream_id" text NOT NULL,
	"is_agent" boolean DEFAULT false NOT NULL,
	"heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "presence_stream_workspace_id_workspace_key_principal_id_stream_id_pk" PRIMARY KEY("workspace_id","workspace_key","principal_id","stream_id")
);
--> statement-breakpoint
ALTER TABLE "quills"."presence_stream" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."rate_bucket" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"workspace_key" text NOT NULL,
	"key" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rate_bucket_workspace_id_workspace_key_key_pk" PRIMARY KEY("workspace_id","workspace_key","key")
);
--> statement-breakpoint
ALTER TABLE "quills"."rate_bucket" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."realtime_overflow" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" bigint GENERATED ALWAYS AS IDENTITY (sequence name "quills"."realtime_overflow_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"workspace_key" text NOT NULL,
	"channel" text NOT NULL,
	"payload" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "realtime_overflow_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."realtime_overflow" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."apps" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" text NOT NULL,
	"oauth_client_id" text NOT NULL,
	"name" text NOT NULL,
	"granted_scopes" text[] DEFAULT '{}' NOT NULL,
	"webhook_endpoint" text,
	"webhook_secret_enc" text,
	"subscribed_event_types" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "apps_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."apps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."audit_log" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" uuid,
	"actor_email" text,
	"actor_role" text,
	"actor_ip" text,
	"actor_user_agent" text,
	"request_id" text,
	"actor_type" text,
	"auth_method" text,
	"event_type" text NOT NULL,
	"event_outcome" text DEFAULT 'success' NOT NULL,
	"target_type" text,
	"target_id" text,
	"before_value" jsonb,
	"after_value" jsonb,
	"metadata" jsonb,
	"channel" text,
	"credential_kind" text,
	"credential_id" text,
	"client_name" text,
	"on_behalf_of_principal_id" uuid,
	CONSTRAINT "audit_log_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."push_devices" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"principal_id" uuid NOT NULL,
	"token" text NOT NULL,
	"platform" text NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_devices_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."push_devices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."assistant_documents" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"title" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"storage_key" text,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"embedding_model" text,
	"embedding_updated_at" timestamp with time zone,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "assistant_documents_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "assistant_documents_title_length_check" CHECK (char_length("quills"."assistant_documents"."title") <= 200)
);
--> statement-breakpoint
ALTER TABLE "quills"."assistant_documents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."assistant_involvements" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"triggered_by" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"handoff_reason" text,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rating" integer,
	"escalation_offered_at" timestamp with time zone,
	"last_assistant_answer_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "assistant_involvements_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."assistant_involvements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."assistant_snippets" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"audience" text DEFAULT 'team' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"embedding" vector(1536),
	"embedding_model" text,
	"embedding_updated_at" timestamp with time zone,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assistant_snippets_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "assistant_snippets_title_length_check" CHECK (char_length("quills"."assistant_snippets"."title") <= 120),
	CONSTRAINT "assistant_snippets_content_length_check" CHECK (char_length("quills"."assistant_snippets"."content") <= 2000),
	CONSTRAINT "assistant_snippets_audience_check" CHECK ("quills"."assistant_snippets"."audience" IN ('public','team','internal'))
);
--> statement-breakpoint
ALTER TABLE "quills"."assistant_snippets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."files" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"name" text NOT NULL,
	"content_type" text NOT NULL,
	"declared_type" text,
	"family" text NOT NULL,
	"size" bigint NOT NULL,
	"sha256" text NOT NULL,
	"source" text NOT NULL,
	"uploaded_by_id" uuid,
	"message_id" uuid,
	"attached_at" timestamp with time zone,
	"preview_status" text DEFAULT 'pending' NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"text_excerpt" text,
	"open_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "files_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."assistant_guidance_rules" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"applies_when" text,
	"instruction" text NOT NULL,
	"agent" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assistant_guidance_rules_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "assistant_guidance_rules_name_length_check" CHECK (char_length("quills"."assistant_guidance_rules"."name") BETWEEN 1 AND 80),
	CONSTRAINT "assistant_guidance_rules_applies_when_length_check" CHECK ("quills"."assistant_guidance_rules"."applies_when" IS NULL OR char_length("quills"."assistant_guidance_rules"."applies_when") BETWEEN 1 AND 500),
	CONSTRAINT "assistant_guidance_rules_instruction_length_check" CHECK (char_length("quills"."assistant_guidance_rules"."instruction") BETWEEN 1 AND 1000),
	CONSTRAINT "assistant_guidance_rules_agent_check" CHECK ("quills"."assistant_guidance_rules"."agent" IN ('agent', 'copilot', 'workspace'))
);
--> statement-breakpoint
ALTER TABLE "quills"."assistant_guidance_rules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."assistant_pending_actions" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"conversation_id" uuid,
	"ticket_id" uuid,
	"involvement_id" uuid,
	"workspace_thread_key" text,
	"tool_name" text NOT NULL,
	"args" jsonb NOT NULL,
	"summary" text NOT NULL,
	"origin_role" text DEFAULT 'customer_support' NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"proposed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"decided_by_id" uuid,
	"decided_at" timestamp with time zone,
	"executed_at" timestamp with time zone,
	"result" jsonb,
	"idempotency_key" text,
	"requested_by_id" uuid,
	"on_behalf_of_principal_id" uuid,
	"requested_via" text,
	"credential_id" text,
	"client_name" text,
	"risk" text,
	"args_digest" text,
	"contract_digest" text,
	"decided_via" text,
	"decision_reason" text,
	"execution_state" text,
	"execution_job_id" text,
	"execution_error" text,
	"disposition" text,
	CONSTRAINT "assistant_pending_actions_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "assistant_pending_actions_status_check" CHECK ("quills"."assistant_pending_actions"."status" IN ('proposed','approved','rejected','expired','executed','failed')),
	CONSTRAINT "assistant_pending_actions_parent_check" CHECK (num_nonnulls("quills"."assistant_pending_actions"."conversation_id", "quills"."assistant_pending_actions"."ticket_id", "quills"."assistant_pending_actions"."workspace_thread_key") <= 1)
);
--> statement-breakpoint
ALTER TABLE "quills"."assistant_pending_actions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."assistant_tool_calls" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"conversation_id" uuid,
	"involvement_id" uuid,
	"pending_action_id" uuid,
	"tool_name" text NOT NULL,
	"args" jsonb NOT NULL,
	"status" text DEFAULT 'started' NOT NULL,
	"result_summary" text,
	"error" text,
	"latency_ms" integer,
	"idempotency_key" text,
	"principal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assistant_tool_calls_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "assistant_tool_calls_status_check" CHECK ("quills"."assistant_tool_calls"."status" IN ('started','succeeded','failed','denied','skipped_duplicate'))
);
--> statement-breakpoint
ALTER TABLE "quills"."assistant_tool_calls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."assistant_events" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"principal_id" uuid,
	"conversation_id" uuid,
	"ticket_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assistant_events_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."assistant_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."connectors" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"url" text NOT NULL,
	"auth_mode" text NOT NULL,
	"secrets" text,
	"status" text DEFAULT 'connected' NOT NULL,
	"tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tool_policies" jsonb DEFAULT '{"tools":{},"groupDefaults":{"read":"always","write":"approval"}}'::jsonb NOT NULL,
	"assignments" jsonb DEFAULT '{"agent":false,"copilot":false}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_call_at" timestamp with time zone,
	"last_error" text,
	"last_error_at" timestamp with time zone,
	"error_count" integer DEFAULT 0 NOT NULL,
	"created_by_principal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "connectors_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "connectors_name_length_check" CHECK (char_length("quills"."connectors"."name") BETWEEN 1 AND 80),
	CONSTRAINT "connectors_slug_length_check" CHECK (char_length("quills"."connectors"."slug") BETWEEN 1 AND 20),
	CONSTRAINT "connectors_auth_mode_check" CHECK ("quills"."connectors"."auth_mode" IN ('none', 'bearer', 'oauth')),
	CONSTRAINT "connectors_status_check" CHECK ("quills"."connectors"."status" IN ('connected', 'error', 'disabled'))
);
--> statement-breakpoint
ALTER TABLE "quills"."connectors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."agent_skills" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"when_to_use" text NOT NULL,
	"instructions" text NOT NULL,
	"assignments" jsonb DEFAULT '{"agent":false,"copilot":false}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by_principal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_skills_workspace_id_id_pk" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "agent_skills_name_length_check" CHECK (char_length("quills"."agent_skills"."name") BETWEEN 1 AND 80),
	CONSTRAINT "agent_skills_when_to_use_length_check" CHECK (char_length("quills"."agent_skills"."when_to_use") BETWEEN 1 AND 240),
	CONSTRAINT "agent_skills_instructions_length_check" CHECK (char_length("quills"."agent_skills"."instructions") BETWEEN 1 AND 8000)
);
--> statement-breakpoint
ALTER TABLE "quills"."agent_skills" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."assistant_web_sources" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assistant_web_sources_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."assistant_web_sources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."macros" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"scope" text DEFAULT 'support' NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_principal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "macros_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."macros" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."import_runs" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"source" text NOT NULL,
	"file_name" text NOT NULL,
	"initiated_by_principal_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"totals" jsonb,
	"error_report" jsonb,
	"batch_tag_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "import_runs_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."import_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."export_runs" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"file_name" text NOT NULL,
	"s3_key" text,
	"size_bytes" integer,
	"entity_counts" jsonb,
	"error" text,
	"initiated_by_principal_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	CONSTRAINT "export_runs_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."export_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."workspace_experiments" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"settings_id" uuid NOT NULL,
	"experiment_id" text NOT NULL,
	"visible" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_experiments_pkey" PRIMARY KEY("workspace_id","settings_id","experiment_id")
);
--> statement-breakpoint
ALTER TABLE "quills"."workspace_experiments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."slack_thread_sessions" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"slack_team_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"thread_ts" text NOT NULL,
	"status" text NOT NULL,
	"last_speaker" text NOT NULL,
	"last_event_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "slack_thread_sessions_pkey" PRIMARY KEY("workspace_id","slack_team_id","channel_id","thread_ts")
);
--> statement-breakpoint
ALTER TABLE "quills"."slack_thread_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."slack_user_links" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"slack_team_id" text NOT NULL,
	"slack_user_id" text NOT NULL,
	"principal_id" uuid NOT NULL,
	"method" text NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"suggested_prompts_at" timestamp with time zone,
	CONSTRAINT "slack_user_links_pkey" PRIMARY KEY("workspace_id","slack_team_id","slack_user_id")
);
--> statement-breakpoint
ALTER TABLE "quills"."slack_user_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."integration_deliveries" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"provider" text NOT NULL,
	"delivery_id" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_deliveries_pkey" PRIMARY KEY("workspace_id","provider","delivery_id")
);
--> statement-breakpoint
ALTER TABLE "quills"."integration_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."integration_sync_actions" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid NOT NULL,
	"operation_id" uuid NOT NULL,
	"action" text NOT NULL,
	"principal_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_sync_actions_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."integration_sync_actions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."integration_sync_attempts" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"token" uuid NOT NULL,
	"state" text NOT NULL,
	"error_code" text,
	"result" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "integration_sync_attempts_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."integration_sync_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."integration_sync_operations" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"operation_key" text NOT NULL,
	"integration_id" text NOT NULL,
	"installation" text NOT NULL,
	"provider" text NOT NULL,
	"direction" text NOT NULL,
	"kind" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"source_record_id" uuid,
	"source_revision" text,
	"destination" jsonb NOT NULL,
	"destination_key" text NOT NULL,
	"remote_id" text,
	"state" text DEFAULT 'queued' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"payload" text,
	"result" jsonb,
	"error_code" text,
	"lease_token" uuid,
	"lease_expires_at" timestamp with time zone,
	"dispatched_at" timestamp with time zone,
	"cancel_requested" boolean DEFAULT false NOT NULL,
	"requested_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "integration_sync_operations_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."integration_sync_operations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."integration_sync_start" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"id" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_sync_start_workspace_id_id_pk" PRIMARY KEY("workspace_id","id")
);
--> statement-breakpoint
ALTER TABLE "quills"."integration_sync_start" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."workspace_assistant_threads" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"key" text NOT NULL,
	"owner_principal_id" uuid NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"active_run_id" text,
	"lease_token" text,
	"lease_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_assistant_threads_workspace_id_key_pk" PRIMARY KEY("workspace_id","key")
);
--> statement-breakpoint
ALTER TABLE "quills"."workspace_assistant_threads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."onboarding_emails" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"principal_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quills"."onboarding_emails" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quills"."oauth_client" ADD CONSTRAINT "oauth_client_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."oauth_client" ADD CONSTRAINT "oauth_client_workspace_id_user_id_customer_identity_workspace_id_id_fk" FOREIGN KEY ("workspace_id","user_id") REFERENCES "quills"."customer_identity"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."principal" ADD CONSTRAINT "principal_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."principal" ADD CONSTRAINT "principal_test_owner_principal_id_principal_id_fk" FOREIGN KEY ("workspace_id","test_owner_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."principal" ADD CONSTRAINT "principal_blocked_by_principal_id_principal_id_fk" FOREIGN KEY ("workspace_id","blocked_by_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("blocked_by_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."principal" ADD CONSTRAINT "principal_workspace_id_user_id_customer_identity_workspace_id_id_fk" FOREIGN KEY ("workspace_id","user_id") REFERENCES "quills"."customer_identity"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."principal" ADD CONSTRAINT "principal_workspace_id_company_id_companies_workspace_id_id_fk" FOREIGN KEY ("workspace_id","company_id") REFERENCES "quills"."companies"("workspace_id","id") ON DELETE SET NULL ("company_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."settings" ADD CONSTRAINT "settings_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."customer_identity" ADD CONSTRAINT "customer_identity_kaneo_user_id_user_id_fk" FOREIGN KEY ("kaneo_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."customer_identity" ADD CONSTRAINT "customer_identity_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."widget_identified_session" ADD CONSTRAINT "widget_identified_session_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."widget_origin_session" ADD CONSTRAINT "widget_origin_session_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."permissions" ADD CONSTRAINT "permissions_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."principal_role_assignments" ADD CONSTRAINT "principal_role_assignments_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."principal_role_assignments" ADD CONSTRAINT "principal_role_assignments_granted_by_principal_id_principal_id" FOREIGN KEY ("workspace_id","granted_by_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("granted_by_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."principal_role_assignments" ADD CONSTRAINT "principal_role_assignments_team_id_teams_id_fk" FOREIGN KEY ("workspace_id","team_id") REFERENCES "quills"."teams"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."principal_role_assignments" ADD CONSTRAINT "principal_role_assignments_workspace_id_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."principal_role_assignments" ADD CONSTRAINT "principal_role_assignments_workspace_id_role_id_roles_workspace_id_id_fk" FOREIGN KEY ("workspace_id","role_id") REFERENCES "quills"."roles"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."role_permissions" ADD CONSTRAINT "role_permissions_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."role_permissions" ADD CONSTRAINT "role_permissions_workspace_id_role_id_roles_workspace_id_id_fk" FOREIGN KEY ("workspace_id","role_id") REFERENCES "quills"."roles"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."role_permissions" ADD CONSTRAINT "role_permissions_workspace_id_permission_id_permissions_workspace_id_id_fk" FOREIGN KEY ("workspace_id","permission_id") REFERENCES "quills"."permissions"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."roles" ADD CONSTRAINT "roles_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."boards" ADD CONSTRAINT "boards_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_tags" ADD CONSTRAINT "post_tags_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."roadmap_columns" ADD CONSTRAINT "roadmap_columns_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."roadmap_columns" ADD CONSTRAINT "roadmap_columns_workspace_id_roadmap_id_roadmaps_workspace_id_id_fk" FOREIGN KEY ("workspace_id","roadmap_id") REFERENCES "quills"."roadmaps"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."roadmap_columns" ADD CONSTRAINT "roadmap_columns_workspace_id_status_id_post_statuses_workspace_id_id_fk" FOREIGN KEY ("workspace_id","status_id") REFERENCES "quills"."post_statuses"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."roadmaps" ADD CONSTRAINT "roadmaps_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_statuses" ADD CONSTRAINT "post_statuses_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_comment_edit_history" ADD CONSTRAINT "post_comment_edit_history_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_comment_edit_history" ADD CONSTRAINT "post_comment_edit_history_workspace_id_comment_id_post_comments_workspace_id_id_fk" FOREIGN KEY ("workspace_id","comment_id") REFERENCES "quills"."post_comments"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_comment_edit_history" ADD CONSTRAINT "post_comment_edit_history_workspace_id_editor_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","editor_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("editor_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_comment_reactions" ADD CONSTRAINT "post_comment_reactions_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_comment_reactions" ADD CONSTRAINT "post_comment_reactions_workspace_id_comment_id_post_comments_workspace_id_id_fk" FOREIGN KEY ("workspace_id","comment_id") REFERENCES "quills"."post_comments"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_comment_reactions" ADD CONSTRAINT "post_comment_reactions_workspace_id_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_comments" ADD CONSTRAINT "post_comments_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_comments" ADD CONSTRAINT "post_comments_parent_id_post_comments_id_fk" FOREIGN KEY ("workspace_id","parent_id") REFERENCES "quills"."post_comments"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_comments" ADD CONSTRAINT "post_comments_workspace_id_post_id_posts_workspace_id_id_fk" FOREIGN KEY ("workspace_id","post_id") REFERENCES "quills"."posts"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_comments" ADD CONSTRAINT "post_comments_workspace_id_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_comments" ADD CONSTRAINT "post_comments_workspace_id_status_change_from_id_post_statuses_workspace_id_id_fk" FOREIGN KEY ("workspace_id","status_change_from_id") REFERENCES "quills"."post_statuses"("workspace_id","id") ON DELETE SET NULL ("status_change_from_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_comments" ADD CONSTRAINT "post_comments_workspace_id_status_change_to_id_post_statuses_workspace_id_id_fk" FOREIGN KEY ("workspace_id","status_change_to_id") REFERENCES "quills"."post_statuses"("workspace_id","id") ON DELETE SET NULL ("status_change_to_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_comments" ADD CONSTRAINT "post_comments_workspace_id_deleted_by_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","deleted_by_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("deleted_by_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_edit_history" ADD CONSTRAINT "post_edit_history_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_edit_history" ADD CONSTRAINT "post_edit_history_workspace_id_post_id_posts_workspace_id_id_fk" FOREIGN KEY ("workspace_id","post_id") REFERENCES "quills"."posts"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_edit_history" ADD CONSTRAINT "post_edit_history_workspace_id_editor_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","editor_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("editor_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_notes" ADD CONSTRAINT "post_notes_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_notes" ADD CONSTRAINT "post_notes_workspace_id_post_id_posts_workspace_id_id_fk" FOREIGN KEY ("workspace_id","post_id") REFERENCES "quills"."posts"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_notes" ADD CONSTRAINT "post_notes_workspace_id_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_tag_assignments" ADD CONSTRAINT "post_tag_assignments_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_tag_assignments" ADD CONSTRAINT "post_tags_post_id_posts_id_fk" FOREIGN KEY ("workspace_id","post_id") REFERENCES "quills"."posts"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_tag_assignments" ADD CONSTRAINT "post_tags_tag_id_tags_id_fk" FOREIGN KEY ("workspace_id","tag_id") REFERENCES "quills"."post_tags"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_votes" ADD CONSTRAINT "post_votes_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_votes" ADD CONSTRAINT "post_votes_added_by_principal_id_fkey" FOREIGN KEY ("workspace_id","added_by_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("added_by_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_votes" ADD CONSTRAINT "post_votes_workspace_id_post_id_posts_workspace_id_id_fk" FOREIGN KEY ("workspace_id","post_id") REFERENCES "quills"."posts"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_votes" ADD CONSTRAINT "post_votes_workspace_id_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."posts" ADD CONSTRAINT "posts_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."posts" ADD CONSTRAINT "posts_tracked_by_principal_id_fk" FOREIGN KEY ("workspace_id","tracked_by_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("tracked_by_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."posts" ADD CONSTRAINT "posts_workspace_id_board_id_boards_workspace_id_id_fk" FOREIGN KEY ("workspace_id","board_id") REFERENCES "quills"."boards"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."posts" ADD CONSTRAINT "posts_workspace_id_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."posts" ADD CONSTRAINT "posts_workspace_id_status_id_post_statuses_workspace_id_id_fk" FOREIGN KEY ("workspace_id","status_id") REFERENCES "quills"."post_statuses"("workspace_id","id") ON DELETE SET NULL ("status_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."posts" ADD CONSTRAINT "posts_workspace_id_owner_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","owner_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("owner_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."posts" ADD CONSTRAINT "posts_workspace_id_deleted_by_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","deleted_by_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("deleted_by_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."posts" ADD CONSTRAINT "posts_workspace_id_merged_by_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","merged_by_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("merged_by_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."companies" ADD CONSTRAINT "companies_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."company_attribute_definitions" ADD CONSTRAINT "company_attribute_definitions_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_mentions" ADD CONSTRAINT "post_mentions_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_mentions" ADD CONSTRAINT "post_mentions_post_id_fkey" FOREIGN KEY ("workspace_id","post_id") REFERENCES "quills"."posts"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_mentions" ADD CONSTRAINT "post_mentions_principal_id_fkey" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_views" ADD CONSTRAINT "post_views_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_views" ADD CONSTRAINT "post_views_created_by_principal_id_fkey" FOREIGN KEY ("workspace_id","created_by_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("created_by_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."integration_event_mappings" ADD CONSTRAINT "integration_event_mappings_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."integration_event_mappings" ADD CONSTRAINT "event_mappings_integration_fk" FOREIGN KEY ("workspace_id","integration_id") REFERENCES "quills"."integrations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."integration_platform_credentials" ADD CONSTRAINT "integration_platform_credentials_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."integration_platform_credentials" ADD CONSTRAINT "integration_platform_credentials_configured_by_principal_id_pri" FOREIGN KEY ("workspace_id","configured_by_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("configured_by_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."integrations" ADD CONSTRAINT "integrations_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."integrations" ADD CONSTRAINT "integrations_workspace_id_connected_by_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","connected_by_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."integrations" ADD CONSTRAINT "integrations_workspace_id_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."changelog_entries" ADD CONSTRAINT "changelog_entries_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."changelog_entries" ADD CONSTRAINT "changelog_entries_workspace_id_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."changelog_entry_posts" ADD CONSTRAINT "changelog_entry_posts_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."changelog_entry_posts" ADD CONSTRAINT "changelog_entry_posts_changelog_entry_id_changelog_entries_id_f" FOREIGN KEY ("workspace_id","changelog_entry_id") REFERENCES "quills"."changelog_entries"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."changelog_entry_posts" ADD CONSTRAINT "changelog_entry_posts_workspace_id_post_id_posts_workspace_id_id_fk" FOREIGN KEY ("workspace_id","post_id") REFERENCES "quills"."posts"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."changelog_categories" ADD CONSTRAINT "changelog_categories_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."changelog_entry_categories" ADD CONSTRAINT "changelog_entry_categories_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."changelog_entry_categories" ADD CONSTRAINT "changelog_entry_categories_entry_fk" FOREIGN KEY ("workspace_id","changelog_entry_id") REFERENCES "quills"."changelog_entries"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."changelog_entry_categories" ADD CONSTRAINT "changelog_entry_categories_category_fk" FOREIGN KEY ("workspace_id","category_id") REFERENCES "quills"."changelog_categories"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."changelog_subscriptions" ADD CONSTRAINT "changelog_subscriptions_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."changelog_subscriptions" ADD CONSTRAINT "changelog_subscriptions_workspace_id_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."status_component_events" ADD CONSTRAINT "status_component_events_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."status_component_events" ADD CONSTRAINT "status_component_events_workspace_id_component_id_status_components_workspace_id_id_fk" FOREIGN KEY ("workspace_id","component_id") REFERENCES "quills"."status_components"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."status_component_groups" ADD CONSTRAINT "status_component_groups_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."status_components" ADD CONSTRAINT "status_components_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."status_components" ADD CONSTRAINT "status_components_workspace_id_group_id_status_component_groups_workspace_id_id_fk" FOREIGN KEY ("workspace_id","group_id") REFERENCES "quills"."status_component_groups"("workspace_id","id") ON DELETE SET NULL ("group_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."status_incident_components" ADD CONSTRAINT "status_incident_components_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."status_incident_components" ADD CONSTRAINT "status_incident_components_workspace_id_incident_id_status_incidents_workspace_id_id_fk" FOREIGN KEY ("workspace_id","incident_id") REFERENCES "quills"."status_incidents"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."status_incident_components" ADD CONSTRAINT "status_incident_components_workspace_id_component_id_status_components_workspace_id_id_fk" FOREIGN KEY ("workspace_id","component_id") REFERENCES "quills"."status_components"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."status_incident_templates" ADD CONSTRAINT "status_incident_templates_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."status_incident_updates" ADD CONSTRAINT "status_incident_updates_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."status_incident_updates" ADD CONSTRAINT "status_incident_updates_template_id_status_incident_templates_i" FOREIGN KEY ("workspace_id","template_id") REFERENCES "quills"."status_incident_templates"("workspace_id","id") ON DELETE SET NULL ("template_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."status_incident_updates" ADD CONSTRAINT "status_incident_updates_workspace_id_incident_id_status_incidents_workspace_id_id_fk" FOREIGN KEY ("workspace_id","incident_id") REFERENCES "quills"."status_incidents"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."status_incident_updates" ADD CONSTRAINT "status_incident_updates_workspace_id_created_by_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","created_by") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("created_by") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."status_incidents" ADD CONSTRAINT "status_incidents_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."status_incidents" ADD CONSTRAINT "status_incidents_workspace_id_created_by_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","created_by") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("created_by") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."status_subscriptions" ADD CONSTRAINT "status_subscriptions_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."status_subscriptions" ADD CONSTRAINT "status_subscriptions_workspace_id_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_message_flags" ADD CONSTRAINT "conversation_message_flags_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_message_flags" ADD CONSTRAINT "conversation_message_flags_conversation_message_id_fkey" FOREIGN KEY ("workspace_id","conversation_message_id") REFERENCES "quills"."conversation_messages"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_message_flags" ADD CONSTRAINT "conversation_message_flags_principal_id_fkey" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_message_mentions" ADD CONSTRAINT "conversation_message_mentions_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_message_mentions" ADD CONSTRAINT "conversation_message_mentions_conversation_message_id_fkey" FOREIGN KEY ("workspace_id","conversation_message_id") REFERENCES "quills"."conversation_messages"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_message_mentions" ADD CONSTRAINT "conversation_message_mentions_principal_id_fkey" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_message_reactions" ADD CONSTRAINT "conversation_message_reactions_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_message_reactions" ADD CONSTRAINT "conversation_message_reactions_conversation_message_id_fkey" FOREIGN KEY ("workspace_id","conversation_message_id") REFERENCES "quills"."conversation_messages"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_message_reactions" ADD CONSTRAINT "conversation_message_reactions_principal_id_fkey" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_message_translations" ADD CONSTRAINT "conversation_message_translations_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_message_translations" ADD CONSTRAINT "conversation_message_translations_message_id_fkey" FOREIGN KEY ("workspace_id","conversation_message_id") REFERENCES "quills"."conversation_messages"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_messages" ADD CONSTRAINT "conversation_messages_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_fkey" FOREIGN KEY ("workspace_id","conversation_id") REFERENCES "quills"."conversations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_messages" ADD CONSTRAINT "conversation_messages_ticket_id_fkey" FOREIGN KEY ("workspace_id","ticket_id") REFERENCES "quills"."tickets"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_messages" ADD CONSTRAINT "conversation_messages_workspace_thread_key_fkey" FOREIGN KEY ("workspace_id","workspace_thread_key") REFERENCES "quills"."workspace_assistant_threads"("workspace_id","key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_messages" ADD CONSTRAINT "conversation_messages_principal_id_fkey" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_messages" ADD CONSTRAINT "conversation_messages_deleted_by_principal_id_fkey" FOREIGN KEY ("workspace_id","deleted_by_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("deleted_by_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_participants" ADD CONSTRAINT "conversation_participants_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("workspace_id","conversation_id") REFERENCES "quills"."conversations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_participants" ADD CONSTRAINT "conversation_participants_principal_id_fkey" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_participants" ADD CONSTRAINT "conversation_participants_added_by_fkey" FOREIGN KEY ("workspace_id","added_by_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("added_by_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_tag_assignments" ADD CONSTRAINT "conversation_tag_assignments_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_tag_assignments" ADD CONSTRAINT "conversation_tag_assignments_conversation_id_fkey" FOREIGN KEY ("workspace_id","conversation_id") REFERENCES "quills"."conversations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_tag_assignments" ADD CONSTRAINT "conversation_tag_assignments_conversation_tag_id_fkey" FOREIGN KEY ("workspace_id","conversation_tag_id") REFERENCES "quills"."conversation_tags"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_tags" ADD CONSTRAINT "conversation_tags_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversations" ADD CONSTRAINT "conversations_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversations" ADD CONSTRAINT "conversations_visitor_principal_id_fkey" FOREIGN KEY ("workspace_id","visitor_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversations" ADD CONSTRAINT "conversations_assigned_agent_principal_id_fkey" FOREIGN KEY ("workspace_id","assigned_agent_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("assigned_agent_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversations" ADD CONSTRAINT "conversations_assigned_team_id_fkey" FOREIGN KEY ("workspace_id","assigned_team_id") REFERENCES "quills"."teams"("workspace_id","id") ON DELETE SET NULL ("assigned_team_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversations" ADD CONSTRAINT "conversations_channel_account_id_fkey" FOREIGN KEY ("workspace_id","channel_account_id") REFERENCES "quills"."channel_accounts"("workspace_id","id") ON DELETE SET NULL ("channel_account_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_summaries" ADD CONSTRAINT "conversation_summaries_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_summaries" ADD CONSTRAINT "conversation_summaries_workspace_id_conversation_id_conversations_workspace_id_id_fk" FOREIGN KEY ("workspace_id","conversation_id") REFERENCES "quills"."conversations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_summaries" ADD CONSTRAINT "conversation_summaries_workspace_id_visitor_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","visitor_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_view_pins" ADD CONSTRAINT "conversation_view_pins_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_view_pins" ADD CONSTRAINT "conversation_view_pins_principal_id_fkey" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_view_pins" ADD CONSTRAINT "conversation_view_pins_view_id_fkey" FOREIGN KEY ("workspace_id","view_id") REFERENCES "quills"."conversation_views"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_views" ADD CONSTRAINT "conversation_views_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_views" ADD CONSTRAINT "conversation_views_created_by_principal_id_fkey" FOREIGN KEY ("workspace_id","created_by_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("created_by_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_attribute_definitions" ADD CONSTRAINT "conversation_attribute_definitions_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."team_members" ADD CONSTRAINT "team_members_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("workspace_id","team_id") REFERENCES "quills"."teams"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."team_members" ADD CONSTRAINT "team_members_principal_id_fkey" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."teams" ADD CONSTRAINT "teams_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."teams" ADD CONSTRAINT "teams_rr_cursor_principal_id_fkey" FOREIGN KEY ("workspace_id","rr_cursor_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("rr_cursor_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."ticket_conversations" ADD CONSTRAINT "ticket_conversations_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."ticket_conversations" ADD CONSTRAINT "ticket_conversations_ticket_id_fkey" FOREIGN KEY ("workspace_id","ticket_id") REFERENCES "quills"."tickets"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."ticket_conversations" ADD CONSTRAINT "ticket_conversations_conversation_id_fkey" FOREIGN KEY ("workspace_id","conversation_id") REFERENCES "quills"."conversations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."ticket_conversations" ADD CONSTRAINT "ticket_conversations_linked_by_principal_id_fkey" FOREIGN KEY ("workspace_id","linked_by_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("linked_by_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."ticket_links" ADD CONSTRAINT "ticket_links_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."ticket_links" ADD CONSTRAINT "ticket_links_tracker_ticket_id_fkey" FOREIGN KEY ("workspace_id","tracker_ticket_id") REFERENCES "quills"."tickets"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."ticket_links" ADD CONSTRAINT "ticket_links_linked_ticket_id_fkey" FOREIGN KEY ("workspace_id","linked_ticket_id") REFERENCES "quills"."tickets"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."ticket_links" ADD CONSTRAINT "ticket_links_linked_by_principal_id_fkey" FOREIGN KEY ("workspace_id","linked_by_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("linked_by_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."ticket_statuses" ADD CONSTRAINT "ticket_statuses_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."tickets" ADD CONSTRAINT "tickets_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."tickets" ADD CONSTRAINT "tickets_status_id_fkey" FOREIGN KEY ("workspace_id","status_id") REFERENCES "quills"."ticket_statuses"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."tickets" ADD CONSTRAINT "tickets_requester_principal_id_fkey" FOREIGN KEY ("workspace_id","requester_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("requester_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."tickets" ADD CONSTRAINT "tickets_assignee_principal_id_fkey" FOREIGN KEY ("workspace_id","assignee_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("assignee_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."tickets" ADD CONSTRAINT "tickets_assignee_team_id_fkey" FOREIGN KEY ("workspace_id","assignee_team_id") REFERENCES "quills"."teams"("workspace_id","id") ON DELETE SET NULL ("assignee_team_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."tickets" ADD CONSTRAINT "tickets_company_id_fkey" FOREIGN KEY ("workspace_id","company_id") REFERENCES "quills"."companies"("workspace_id","id") ON DELETE SET NULL ("company_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."tickets" ADD CONSTRAINT "tickets_ticket_type_id_fkey" FOREIGN KEY ("workspace_id","ticket_type_id") REFERENCES "quills"."ticket_types"("workspace_id","id") ON DELETE SET NULL ("ticket_type_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."ticket_types" ADD CONSTRAINT "ticket_types_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."ticket_summaries" ADD CONSTRAINT "ticket_summaries_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."ticket_summaries" ADD CONSTRAINT "ticket_summaries_workspace_id_ticket_id_tickets_workspace_id_id_fk" FOREIGN KEY ("workspace_id","ticket_id") REFERENCES "quills"."tickets"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."ticket_summaries" ADD CONSTRAINT "ticket_summaries_workspace_id_requester_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","requester_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("requester_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."ticket_subscriptions" ADD CONSTRAINT "ticket_subscriptions_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."ticket_subscriptions" ADD CONSTRAINT "ticket_subscriptions_ticket_id_fkey" FOREIGN KEY ("workspace_id","ticket_id") REFERENCES "quills"."tickets"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."ticket_subscriptions" ADD CONSTRAINT "ticket_subscriptions_principal_id_fkey" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."ticket_activity" ADD CONSTRAINT "ticket_activity_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."ticket_activity" ADD CONSTRAINT "ticket_activity_workspace_id_ticket_id_tickets_workspace_id_id_fk" FOREIGN KEY ("workspace_id","ticket_id") REFERENCES "quills"."tickets"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."ticket_activity" ADD CONSTRAINT "ticket_activity_workspace_id_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."channel_accounts" ADD CONSTRAINT "channel_accounts_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."channel_accounts" ADD CONSTRAINT "channel_accounts_owning_team_id_fkey" FOREIGN KEY ("workspace_id","owning_team_id") REFERENCES "quills"."teams"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."channel_accounts" ADD CONSTRAINT "channel_accounts_sending_domain_id_fkey" FOREIGN KEY ("workspace_id","sending_domain_id") REFERENCES "quills"."email_sending_domains"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."email_sending_domains" ADD CONSTRAINT "email_sending_domains_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."email_sending_domains" ADD CONSTRAINT "email_sending_domains_owning_team_id_fkey" FOREIGN KEY ("workspace_id","owning_team_id") REFERENCES "quills"."teams"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."email_ses_tenants" ADD CONSTRAINT "email_ses_tenants_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."channel_threads" ADD CONSTRAINT "channel_threads_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."channel_threads" ADD CONSTRAINT "channel_threads_channel_account_id_fkey" FOREIGN KEY ("workspace_id","channel_account_id") REFERENCES "quills"."channel_accounts"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."channel_threads" ADD CONSTRAINT "channel_threads_conversation_id_fkey" FOREIGN KEY ("workspace_id","conversation_id") REFERENCES "quills"."conversations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."office_hours_schedules" ADD CONSTRAINT "office_hours_schedules_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."sla_events" ADD CONSTRAINT "sla_events_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."sla_events" ADD CONSTRAINT "sla_events_conversation_id_fkey" FOREIGN KEY ("workspace_id","conversation_id") REFERENCES "quills"."conversations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."sla_events" ADD CONSTRAINT "sla_events_ticket_id_fkey" FOREIGN KEY ("workspace_id","ticket_id") REFERENCES "quills"."tickets"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."sla_events" ADD CONSTRAINT "sla_events_policy_id_fkey" FOREIGN KEY ("workspace_id","policy_id") REFERENCES "quills"."sla_policies"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."sla_policies" ADD CONSTRAINT "sla_policies_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."sla_policies" ADD CONSTRAINT "sla_policies_office_hours_schedule_id_fkey" FOREIGN KEY ("workspace_id","office_hours_schedule_id") REFERENCES "quills"."office_hours_schedules"("workspace_id","id") ON DELETE SET NULL ("office_hours_schedule_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."workflow_run_events" ADD CONSTRAINT "workflow_run_events_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."workflow_run_events" ADD CONSTRAINT "workflow_run_events_run_id_fkey" FOREIGN KEY ("workspace_id","run_id") REFERENCES "quills"."workflow_runs"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."workflow_run_events" ADD CONSTRAINT "workflow_run_events_workflow_id_fkey" FOREIGN KEY ("workspace_id","workflow_id") REFERENCES "quills"."workflows"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."workflow_run_events" ADD CONSTRAINT "workflow_run_events_subject_principal_id_fkey" FOREIGN KEY ("workspace_id","subject_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("subject_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."workflow_runs" ADD CONSTRAINT "workflow_runs_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_id_fkey" FOREIGN KEY ("workspace_id","workflow_id") REFERENCES "quills"."workflows"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."workflow_runs" ADD CONSTRAINT "workflow_runs_conversation_id_fkey" FOREIGN KEY ("workspace_id","conversation_id") REFERENCES "quills"."conversations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."workflow_runs" ADD CONSTRAINT "workflow_runs_subject_principal_id_fkey" FOREIGN KEY ("workspace_id","subject_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("subject_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."workflow_versions" ADD CONSTRAINT "workflow_versions_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."workflow_versions" ADD CONSTRAINT "workflow_versions_workflow_id_fkey" FOREIGN KEY ("workspace_id","workflow_id") REFERENCES "quills"."workflows"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."workflow_versions" ADD CONSTRAINT "workflow_versions_created_by_fkey" FOREIGN KEY ("workspace_id","created_by") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("created_by") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."workflows" ADD CONSTRAINT "workflows_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."workflows" ADD CONSTRAINT "workflows_created_by_fkey" FOREIGN KEY ("workspace_id","created_by") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("created_by") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."channel_identities" ADD CONSTRAINT "channel_identities_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."channel_identities" ADD CONSTRAINT "channel_identities_principal_id_fkey" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_outbound_emails" ADD CONSTRAINT "conversation_outbound_emails_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."conversation_outbound_emails" ADD CONSTRAINT "conversation_outbound_emails_conversation_id_fkey" FOREIGN KEY ("workspace_id","conversation_id") REFERENCES "quills"."conversations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."in_app_notifications" ADD CONSTRAINT "in_app_notifications_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."in_app_notifications" ADD CONSTRAINT "in_app_notifications_workspace_id_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."in_app_notifications" ADD CONSTRAINT "in_app_notifications_workspace_id_post_id_posts_workspace_id_id_fk" FOREIGN KEY ("workspace_id","post_id") REFERENCES "quills"."posts"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."in_app_notifications" ADD CONSTRAINT "in_app_notifications_workspace_id_comment_id_post_comments_workspace_id_id_fk" FOREIGN KEY ("workspace_id","comment_id") REFERENCES "quills"."post_comments"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."notification_preferences" ADD CONSTRAINT "notification_preferences_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."notification_preferences" ADD CONSTRAINT "notification_preferences_workspace_id_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_subscriptions" ADD CONSTRAINT "post_subscriptions_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_subscriptions" ADD CONSTRAINT "post_subscriptions_workspace_id_post_id_posts_workspace_id_id_fk" FOREIGN KEY ("workspace_id","post_id") REFERENCES "quills"."posts"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_subscriptions" ADD CONSTRAINT "post_subscriptions_workspace_id_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."unsubscribe_tokens" ADD CONSTRAINT "unsubscribe_tokens_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."unsubscribe_tokens" ADD CONSTRAINT "unsubscribe_tokens_workspace_id_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."unsubscribe_tokens" ADD CONSTRAINT "unsubscribe_tokens_workspace_id_post_id_posts_workspace_id_id_fk" FOREIGN KEY ("workspace_id","post_id") REFERENCES "quills"."posts"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_sentiment" ADD CONSTRAINT "post_sentiment_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_sentiment" ADD CONSTRAINT "post_sentiment_workspace_id_post_id_posts_workspace_id_id_fk" FOREIGN KEY ("workspace_id","post_id") REFERENCES "quills"."posts"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."api_keys" ADD CONSTRAINT "api_keys_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."api_keys" ADD CONSTRAINT "api_keys_workspace_id_created_by_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","created_by_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("created_by_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."api_keys" ADD CONSTRAINT "api_keys_workspace_id_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."webhooks" ADD CONSTRAINT "webhooks_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."webhooks" ADD CONSTRAINT "webhooks_workspace_id_created_by_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","created_by_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_external_links" ADD CONSTRAINT "post_external_links_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_external_links" ADD CONSTRAINT "post_external_links_post_fk" FOREIGN KEY ("workspace_id","post_id") REFERENCES "quills"."posts"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_external_links" ADD CONSTRAINT "post_external_links_integration_fk" FOREIGN KEY ("workspace_id","integration_id") REFERENCES "quills"."integrations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."ticket_external_links" ADD CONSTRAINT "ticket_external_links_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."ticket_external_links" ADD CONSTRAINT "ticket_external_links_ticket_fk" FOREIGN KEY ("workspace_id","ticket_id") REFERENCES "quills"."tickets"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."ticket_external_links" ADD CONSTRAINT "ticket_external_links_integration_fk" FOREIGN KEY ("workspace_id","integration_id") REFERENCES "quills"."integrations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."segments" ADD CONSTRAINT "segments_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."user_segments" ADD CONSTRAINT "user_segments_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."user_segments" ADD CONSTRAINT "user_segments_workspace_id_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."user_segments" ADD CONSTRAINT "user_segments_workspace_id_segment_id_segments_workspace_id_id_fk" FOREIGN KEY ("workspace_id","segment_id") REFERENCES "quills"."segments"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."user_attribute_definitions" ADD CONSTRAINT "user_attribute_definitions_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."user_tag_assignments" ADD CONSTRAINT "user_tag_assignments_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."user_tag_assignments" ADD CONSTRAINT "user_tag_assignments_principal_id_fk" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."user_tag_assignments" ADD CONSTRAINT "user_tag_assignments_tag_id_fk" FOREIGN KEY ("workspace_id","tag_id") REFERENCES "quills"."user_tags"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."user_tags" ADD CONSTRAINT "user_tags_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_merge_suggestions" ADD CONSTRAINT "post_merge_suggestions_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_merge_suggestions" ADD CONSTRAINT "post_merge_suggestions_workspace_id_source_post_id_posts_workspace_id_id_fk" FOREIGN KEY ("workspace_id","source_post_id") REFERENCES "quills"."posts"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_merge_suggestions" ADD CONSTRAINT "post_merge_suggestions_workspace_id_target_post_id_posts_workspace_id_id_fk" FOREIGN KEY ("workspace_id","target_post_id") REFERENCES "quills"."posts"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_merge_suggestions" ADD CONSTRAINT "post_merge_suggestions_workspace_id_resolved_by_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","resolved_by_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("resolved_by_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_activity" ADD CONSTRAINT "post_activity_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_activity" ADD CONSTRAINT "post_activity_workspace_id_post_id_posts_workspace_id_id_fk" FOREIGN KEY ("workspace_id","post_id") REFERENCES "quills"."posts"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_activity" ADD CONSTRAINT "post_activity_workspace_id_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."ai_usage_log" ADD CONSTRAINT "ai_usage_log_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."email_log" ADD CONSTRAINT "email_log_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."kb_article_feedback" ADD CONSTRAINT "kb_article_feedback_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."kb_article_feedback" ADD CONSTRAINT "kb_article_feedback_workspace_id_article_id_kb_articles_workspace_id_id_fk" FOREIGN KEY ("workspace_id","article_id") REFERENCES "quills"."kb_articles"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."kb_article_feedback" ADD CONSTRAINT "kb_article_feedback_workspace_id_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."kb_article_translations" ADD CONSTRAINT "kb_article_translations_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."kb_article_translations" ADD CONSTRAINT "kb_article_translations_workspace_id_article_id_kb_articles_workspace_id_id_fk" FOREIGN KEY ("workspace_id","article_id") REFERENCES "quills"."kb_articles"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."kb_articles" ADD CONSTRAINT "kb_articles_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."kb_articles" ADD CONSTRAINT "kb_articles_workspace_id_category_id_kb_categories_workspace_id_id_fk" FOREIGN KEY ("workspace_id","category_id") REFERENCES "quills"."kb_categories"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."kb_articles" ADD CONSTRAINT "kb_articles_workspace_id_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."kb_categories" ADD CONSTRAINT "kb_categories_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."kb_categories" ADD CONSTRAINT "kb_categories_workspace_id_parent_id_kb_categories_workspace_id_id_fk" FOREIGN KEY ("workspace_id","parent_id") REFERENCES "quills"."kb_categories"("workspace_id","id") ON DELETE SET NULL ("parent_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."kb_category_translations" ADD CONSTRAINT "kb_category_translations_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."kb_category_translations" ADD CONSTRAINT "kb_category_translations_workspace_id_category_id_kb_categories_workspace_id_id_fk" FOREIGN KEY ("workspace_id","category_id") REFERENCES "quills"."kb_categories"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."hc_redirect_rules" ADD CONSTRAINT "hc_redirect_rules_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."kb_search_queries" ADD CONSTRAINT "kb_search_queries_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."analytics_daily_stats" ADD CONSTRAINT "analytics_daily_stats_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."analytics_top_posts" ADD CONSTRAINT "analytics_top_posts_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."page_views" ADD CONSTRAINT "page_views_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."visitor_devices" ADD CONSTRAINT "visitor_devices_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."visitor_stats_daily" ADD CONSTRAINT "visitor_stats_daily_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."visitor_top_stats" ADD CONSTRAINT "visitor_top_stats_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."hook_deliveries" ADD CONSTRAINT "hook_deliveries_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."events" ADD CONSTRAINT "events_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."job_queue" ADD CONSTRAINT "job_queue_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."kv_set_member" ADD CONSTRAINT "kv_set_member_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."kv_store" ADD CONSTRAINT "kv_store_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."presence_stream" ADD CONSTRAINT "presence_stream_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."rate_bucket" ADD CONSTRAINT "rate_bucket_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."realtime_overflow" ADD CONSTRAINT "realtime_overflow_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."apps" ADD CONSTRAINT "apps_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."apps" ADD CONSTRAINT "apps_workspace_id_oauth_client_id_oauth_client_workspace_id_client_id_fk" FOREIGN KEY ("workspace_id","oauth_client_id") REFERENCES "quills"."oauth_client"("workspace_id","client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."audit_log" ADD CONSTRAINT "audit_log_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."audit_log" ADD CONSTRAINT "audit_log_actor_user_id_fkey" FOREIGN KEY ("workspace_id","actor_user_id") REFERENCES "quills"."customer_identity"("workspace_id","id") ON DELETE SET NULL ("actor_user_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."push_devices" ADD CONSTRAINT "push_devices_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."push_devices" ADD CONSTRAINT "push_devices_principal_id_fkey" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."assistant_documents" ADD CONSTRAINT "assistant_documents_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."assistant_documents" ADD CONSTRAINT "assistant_documents_workspace_id_created_by_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","created_by_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("created_by_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."assistant_involvements" ADD CONSTRAINT "assistant_involvements_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."assistant_involvements" ADD CONSTRAINT "assistant_involvements_workspace_id_conversation_id_conversations_workspace_id_id_fk" FOREIGN KEY ("workspace_id","conversation_id") REFERENCES "quills"."conversations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."assistant_snippets" ADD CONSTRAINT "assistant_snippets_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."assistant_snippets" ADD CONSTRAINT "assistant_snippets_workspace_id_created_by_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","created_by_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("created_by_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."files" ADD CONSTRAINT "files_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."files" ADD CONSTRAINT "files_workspace_id_uploaded_by_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","uploaded_by_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("uploaded_by_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."files" ADD CONSTRAINT "files_workspace_id_message_id_conversation_messages_workspace_id_id_fk" FOREIGN KEY ("workspace_id","message_id") REFERENCES "quills"."conversation_messages"("workspace_id","id") ON DELETE SET NULL ("message_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."assistant_guidance_rules" ADD CONSTRAINT "assistant_guidance_rules_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."assistant_guidance_rules" ADD CONSTRAINT "assistant_guidance_rules_workspace_id_created_by_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","created_by_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("created_by_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."assistant_pending_actions" ADD CONSTRAINT "assistant_pending_actions_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."assistant_pending_actions" ADD CONSTRAINT "assistant_pending_actions_involvement_id_assistant_involvements" FOREIGN KEY ("workspace_id","involvement_id") REFERENCES "quills"."assistant_involvements"("workspace_id","id") ON DELETE SET NULL ("involvement_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."assistant_pending_actions" ADD CONSTRAINT "assistant_pending_actions_on_behalf_of_fk" FOREIGN KEY ("workspace_id","on_behalf_of_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("on_behalf_of_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."assistant_pending_actions" ADD CONSTRAINT "assistant_pending_actions_workspace_id_conversation_id_conversations_workspace_id_id_fk" FOREIGN KEY ("workspace_id","conversation_id") REFERENCES "quills"."conversations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."assistant_pending_actions" ADD CONSTRAINT "assistant_pending_actions_workspace_id_ticket_id_tickets_workspace_id_id_fk" FOREIGN KEY ("workspace_id","ticket_id") REFERENCES "quills"."tickets"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."assistant_pending_actions" ADD CONSTRAINT "assistant_pending_actions_workspace_id_decided_by_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","decided_by_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("decided_by_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."assistant_pending_actions" ADD CONSTRAINT "assistant_pending_actions_workspace_id_requested_by_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","requested_by_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("requested_by_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."assistant_tool_calls" ADD CONSTRAINT "assistant_tool_calls_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."assistant_tool_calls" ADD CONSTRAINT "assistant_tool_calls_involvement_id_assistant_involvements_id_f" FOREIGN KEY ("workspace_id","involvement_id") REFERENCES "quills"."assistant_involvements"("workspace_id","id") ON DELETE SET NULL ("involvement_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."assistant_tool_calls" ADD CONSTRAINT "assistant_tool_calls_pending_action_id_assistant_pending_action" FOREIGN KEY ("workspace_id","pending_action_id") REFERENCES "quills"."assistant_pending_actions"("workspace_id","id") ON DELETE SET NULL ("pending_action_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."assistant_tool_calls" ADD CONSTRAINT "assistant_tool_calls_workspace_id_conversation_id_conversations_workspace_id_id_fk" FOREIGN KEY ("workspace_id","conversation_id") REFERENCES "quills"."conversations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."assistant_tool_calls" ADD CONSTRAINT "assistant_tool_calls_workspace_id_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."assistant_events" ADD CONSTRAINT "assistant_events_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."assistant_events" ADD CONSTRAINT "assistant_events_workspace_id_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."assistant_events" ADD CONSTRAINT "assistant_events_workspace_id_conversation_id_conversations_workspace_id_id_fk" FOREIGN KEY ("workspace_id","conversation_id") REFERENCES "quills"."conversations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."assistant_events" ADD CONSTRAINT "assistant_events_workspace_id_ticket_id_tickets_workspace_id_id_fk" FOREIGN KEY ("workspace_id","ticket_id") REFERENCES "quills"."tickets"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."connectors" ADD CONSTRAINT "connectors_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."connectors" ADD CONSTRAINT "connectors_workspace_id_created_by_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","created_by_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("created_by_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."agent_skills" ADD CONSTRAINT "agent_skills_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."agent_skills" ADD CONSTRAINT "agent_skills_workspace_id_created_by_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","created_by_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("created_by_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."assistant_web_sources" ADD CONSTRAINT "assistant_web_sources_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."assistant_web_sources" ADD CONSTRAINT "assistant_web_sources_workspace_id_created_by_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","created_by_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("created_by_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."macros" ADD CONSTRAINT "macros_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."macros" ADD CONSTRAINT "macros_workspace_id_created_by_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","created_by_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("created_by_principal_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."import_runs" ADD CONSTRAINT "import_runs_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."import_runs" ADD CONSTRAINT "import_runs_initiated_by_principal_id_fkey" FOREIGN KEY ("workspace_id","initiated_by_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."import_runs" ADD CONSTRAINT "import_runs_batch_tag_id_fkey" FOREIGN KEY ("workspace_id","batch_tag_id") REFERENCES "quills"."post_tags"("workspace_id","id") ON DELETE SET NULL ("batch_tag_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."export_runs" ADD CONSTRAINT "export_runs_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."export_runs" ADD CONSTRAINT "export_runs_initiated_by_principal_id_fkey" FOREIGN KEY ("workspace_id","initiated_by_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."workspace_experiments" ADD CONSTRAINT "workspace_experiments_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."workspace_experiments" ADD CONSTRAINT "workspace_experiments_workspace_id_settings_id_settings_workspace_id_id_fk" FOREIGN KEY ("workspace_id","settings_id") REFERENCES "quills"."settings"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."slack_thread_sessions" ADD CONSTRAINT "slack_thread_sessions_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."slack_user_links" ADD CONSTRAINT "slack_user_links_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."slack_user_links" ADD CONSTRAINT "slack_user_links_principal_id_fkey" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."integration_deliveries" ADD CONSTRAINT "integration_deliveries_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."integration_sync_actions" ADD CONSTRAINT "integration_sync_actions_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."integration_sync_actions" ADD CONSTRAINT "integration_sync_action_operation_fk" FOREIGN KEY ("workspace_id","operation_id") REFERENCES "quills"."integration_sync_operations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."integration_sync_attempts" ADD CONSTRAINT "integration_sync_attempts_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."integration_sync_attempts" ADD CONSTRAINT "integration_sync_attempt_operation_fk" FOREIGN KEY ("workspace_id","operation_id") REFERENCES "quills"."integration_sync_operations"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."integration_sync_operations" ADD CONSTRAINT "integration_sync_operations_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."integration_sync_start" ADD CONSTRAINT "integration_sync_start_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."workspace_assistant_threads" ADD CONSTRAINT "workspace_assistant_threads_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."workspace_assistant_threads" ADD CONSTRAINT "workspace_assistant_threads_owner_principal_id_fkey" FOREIGN KEY ("workspace_id","owner_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."onboarding_emails" ADD CONSTRAINT "onboarding_emails_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."onboarding_emails" ADD CONSTRAINT "onboarding_emails_workspace_id_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "principal_test_owner_idx" ON "quills"."principal" USING btree ("workspace_id","test_owner_principal_id") WHERE test_owner_principal_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "principal_user_idx" ON "quills"."principal" USING btree ("workspace_id","user_id") WHERE user_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "principal_contact_email_idx" ON "quills"."principal" USING btree ("contact_email") WHERE contact_email IS NOT NULL;--> statement-breakpoint
CREATE INDEX "principal_type_idx" ON "quills"."principal" USING btree ("type");--> statement-breakpoint
CREATE INDEX "principal_role_created_at_idx" ON "quills"."principal" USING btree ("role","created_at");--> statement-breakpoint
CREATE INDEX "principal_blocked_by_idx" ON "quills"."principal" USING btree ("blocked_by_principal_id") WHERE "blocked_by_principal_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "principal_displayname_lower_idx" ON "quills"."principal" USING btree (lower(display_name) text_pattern_ops);--> statement-breakpoint
CREATE INDEX "principal_company_id_idx" ON "quills"."principal" USING btree ("company_id") WHERE "company_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_idx" ON "quills"."customer_identity" USING btree ("workspace_id","email") WHERE email IS NOT NULL;--> statement-breakpoint
CREATE INDEX "user_email_lower_idx" ON "quills"."customer_identity" USING btree (LOWER("email")) WHERE email IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_external_id_idx" ON "quills"."customer_identity" USING btree ("workspace_id","external_id") WHERE external_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "user_country_idx" ON "quills"."customer_identity" USING btree ("country") WHERE country IS NOT NULL;--> statement-breakpoint
CREATE INDEX "user_locale_idx" ON "quills"."customer_identity" USING btree ("locale") WHERE locale IS NOT NULL;--> statement-breakpoint
CREATE INDEX "widget_origin_session_user_id_idx" ON "quills"."widget_origin_session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "principal_role_assignments_workspace_unique_idx" ON "quills"."principal_role_assignments" USING btree ("workspace_id","principal_id","role_id") WHERE "quills"."principal_role_assignments"."team_id" IS NULL;--> statement-breakpoint
CREATE INDEX "principal_role_assignments_principal_idx" ON "quills"."principal_role_assignments" USING btree ("principal_id");--> statement-breakpoint
CREATE INDEX "principal_role_assignments_role_idx" ON "quills"."principal_role_assignments" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_unique_idx" ON "quills"."role_permissions" USING btree ("workspace_id","role_id","permission_id");--> statement-breakpoint
CREATE INDEX "boards_deleted_at_idx" ON "quills"."boards" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "post_tags_deleted_at_idx" ON "quills"."post_tags" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "roadmap_columns_roadmap_status_unique" ON "quills"."roadmap_columns" USING btree ("workspace_id","roadmap_id","status_id");--> statement-breakpoint
CREATE INDEX "roadmap_columns_roadmap_position_idx" ON "quills"."roadmap_columns" USING btree ("roadmap_id","position");--> statement-breakpoint
CREATE INDEX "roadmap_columns_status_id_idx" ON "quills"."roadmap_columns" USING btree ("status_id");--> statement-breakpoint
CREATE INDEX "roadmaps_position_idx" ON "quills"."roadmaps" USING btree ("position");--> statement-breakpoint
CREATE INDEX "roadmaps_visibility_idx" ON "quills"."roadmaps" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "roadmaps_deleted_at_idx" ON "quills"."roadmaps" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "post_statuses_position_idx" ON "quills"."post_statuses" USING btree ("category","position");--> statement-breakpoint
CREATE INDEX "post_statuses_deleted_at_idx" ON "quills"."post_statuses" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "post_comment_edit_history_comment_id_idx" ON "quills"."post_comment_edit_history" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "post_comment_edit_history_editor_principal_idx" ON "quills"."post_comment_edit_history" USING btree ("editor_principal_id");--> statement-breakpoint
CREATE INDEX "post_comment_edit_history_created_at_idx" ON "quills"."post_comment_edit_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "post_comment_reactions_principal_id_idx" ON "quills"."post_comment_reactions" USING btree ("principal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "post_comment_reactions_unique_idx" ON "quills"."post_comment_reactions" USING btree ("workspace_id","comment_id","principal_id","emoji");--> statement-breakpoint
CREATE INDEX "post_comments_parent_id_idx" ON "quills"."post_comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "post_comments_principal_id_idx" ON "quills"."post_comments" USING btree ("principal_id");--> statement-breakpoint
CREATE INDEX "post_comments_created_at_idx" ON "quills"."post_comments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "post_comments_post_created_at_idx" ON "quills"."post_comments" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE INDEX "post_comments_moderation_state_idx" ON "quills"."post_comments" USING btree ("moderation_state");--> statement-breakpoint
CREATE INDEX "post_comments_status_change_to_id_idx" ON "quills"."post_comments" USING btree ("status_change_to_id") WHERE status_change_to_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "post_comments_deleted_by_principal_idx" ON "quills"."post_comments" USING btree ("deleted_by_principal_id") WHERE "deleted_by_principal_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "post_edit_history_post_id_idx" ON "quills"."post_edit_history" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "post_edit_history_editor_principal_idx" ON "quills"."post_edit_history" USING btree ("editor_principal_id");--> statement-breakpoint
CREATE INDEX "post_edit_history_created_at_idx" ON "quills"."post_edit_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "post_notes_post_id_idx" ON "quills"."post_notes" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "post_notes_principal_id_idx" ON "quills"."post_notes" USING btree ("principal_id");--> statement-breakpoint
CREATE INDEX "post_notes_created_at_idx" ON "quills"."post_notes" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "post_tag_assignments_pk" ON "quills"."post_tag_assignments" USING btree ("workspace_id","post_id","tag_id");--> statement-breakpoint
CREATE INDEX "post_tag_assignments_tag_id_idx" ON "quills"."post_tag_assignments" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "post_votes_principal_post_idx" ON "quills"."post_votes" USING btree ("workspace_id","post_id","principal_id");--> statement-breakpoint
CREATE INDEX "post_votes_principal_created_at_idx" ON "quills"."post_votes" USING btree ("principal_id","created_at");--> statement-breakpoint
CREATE INDEX "post_votes_source_type_idx" ON "quills"."post_votes" USING btree ("source_type") WHERE source_type IS NOT NULL;--> statement-breakpoint
CREATE INDEX "post_votes_added_by_principal_idx" ON "quills"."post_votes" USING btree ("added_by_principal_id") WHERE "added_by_principal_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "posts_status_id_idx" ON "quills"."posts" USING btree ("status_id");--> statement-breakpoint
CREATE INDEX "posts_owner_principal_id_idx" ON "quills"."posts" USING btree ("owner_principal_id");--> statement-breakpoint
CREATE INDEX "posts_deleted_by_principal_idx" ON "quills"."posts" USING btree ("deleted_by_principal_id") WHERE "deleted_by_principal_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "posts_merged_by_principal_idx" ON "quills"."posts" USING btree ("merged_by_principal_id") WHERE "merged_by_principal_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "posts_tracked_by_principal_id_idx" ON "quills"."posts" USING btree ("tracked_by_principal_id");--> statement-breakpoint
CREATE INDEX "posts_created_at_idx" ON "quills"."posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "posts_vote_count_idx" ON "quills"."posts" USING btree ("vote_count");--> statement-breakpoint
CREATE INDEX "posts_board_vote_idx" ON "quills"."posts" USING btree ("board_id","vote_count");--> statement-breakpoint
CREATE INDEX "posts_board_created_at_idx" ON "quills"."posts" USING btree ("board_id","created_at");--> statement-breakpoint
CREATE INDEX "posts_board_status_idx" ON "quills"."posts" USING btree ("board_id","status_id");--> statement-breakpoint
CREATE INDEX "posts_principal_created_at_idx" ON "quills"."posts" USING btree ("principal_id","created_at");--> statement-breakpoint
CREATE INDEX "posts_with_status_idx" ON "quills"."posts" USING btree ("status_id","vote_count") WHERE status_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "posts_search_vector_idx" ON "quills"."posts" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "posts_deleted_at_idx" ON "quills"."posts" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "posts_board_deleted_at_idx" ON "quills"."posts" USING btree ("board_id","deleted_at");--> statement-breakpoint
CREATE INDEX "posts_moderation_state_idx" ON "quills"."posts" USING btree ("moderation_state");--> statement-breakpoint
CREATE INDEX "posts_pinned_comment_id_idx" ON "quills"."posts" USING btree ("pinned_comment_id");--> statement-breakpoint
CREATE INDEX "posts_canonical_post_id_idx" ON "quills"."posts" USING btree ("canonical_post_id");--> statement-breakpoint
CREATE INDEX "posts_eta_idx" ON "quills"."posts" USING btree ("eta") WHERE "eta" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "companies_domain_lower_idx" ON "quills"."companies" USING btree ("workspace_id",LOWER("domain")) WHERE "domain" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "companies_external_id_idx" ON "quills"."companies" USING btree ("workspace_id","external_id") WHERE "external_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "company_attr_key_idx" ON "quills"."company_attribute_definitions" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "post_mentions_post_principal_uq" ON "quills"."post_mentions" USING btree ("workspace_id","post_id","principal_id");--> statement-breakpoint
CREATE INDEX "post_mentions_principal_idx" ON "quills"."post_mentions" USING btree ("principal_id","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "post_views_shared_idx" ON "quills"."post_views" USING btree ("is_shared") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_event_mappings_lookup" ON "quills"."integration_event_mappings" USING btree ("integration_id","event_type","enabled");--> statement-breakpoint
CREATE INDEX "changelog_published_at_idx" ON "quills"."changelog_entries" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "changelog_principal_id_idx" ON "quills"."changelog_entries" USING btree ("principal_id");--> statement-breakpoint
CREATE INDEX "changelog_deleted_at_idx" ON "quills"."changelog_entries" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "changelog_embedding_hnsw_idx" ON "quills"."changelog_entries" USING hnsw ("embedding" vector_cosine_ops) WHERE "quills"."changelog_entries"."embedding" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "changelog_entry_posts_pk" ON "quills"."changelog_entry_posts" USING btree ("workspace_id","changelog_entry_id","post_id");--> statement-breakpoint
CREATE INDEX "changelog_entry_posts_post_id_idx" ON "quills"."changelog_entry_posts" USING btree ("post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "changelog_category_name_lower_idx" ON "quills"."changelog_categories" USING btree ("workspace_id",lower("name"));--> statement-breakpoint
CREATE INDEX "changelog_category_position_idx" ON "quills"."changelog_categories" USING btree ("position");--> statement-breakpoint
CREATE INDEX "changelog_entry_categories_category_idx" ON "quills"."changelog_entry_categories" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "changelog_subscriptions_principal_idx" ON "quills"."changelog_subscriptions" USING btree ("workspace_id","principal_id");--> statement-breakpoint
CREATE INDEX "status_component_events_component_idx" ON "quills"."status_component_events" USING btree ("component_id","created_at");--> statement-breakpoint
CREATE INDEX "status_components_group_idx" ON "quills"."status_components" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "status_components_deleted_at_idx" ON "quills"."status_components" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "status_incident_components_component_idx" ON "quills"."status_incident_components" USING btree ("component_id");--> statement-breakpoint
CREATE INDEX "status_incident_updates_incident_idx" ON "quills"."status_incident_updates" USING btree ("incident_id","created_at");--> statement-breakpoint
CREATE INDEX "status_incidents_kind_status_idx" ON "quills"."status_incidents" USING btree ("kind","status");--> statement-breakpoint
CREATE INDEX "status_incidents_started_at_idx" ON "quills"."status_incidents" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "status_incidents_deleted_at_idx" ON "quills"."status_incidents" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "status_subscriptions_principal_idx" ON "quills"."status_subscriptions" USING btree ("workspace_id","principal_id");--> statement-breakpoint
CREATE INDEX "conversation_message_flags_principal_idx" ON "quills"."conversation_message_flags" USING btree ("principal_id","flagged_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_message_mentions_message_principal_uq" ON "quills"."conversation_message_mentions" USING btree ("workspace_id","conversation_message_id","principal_id");--> statement-breakpoint
CREATE INDEX "conversation_message_mentions_principal_idx" ON "quills"."conversation_message_mentions" USING btree ("principal_id","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "conversation_message_reactions_principal_idx" ON "quills"."conversation_message_reactions" USING btree ("principal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_message_reactions_unique_idx" ON "quills"."conversation_message_reactions" USING btree ("workspace_id","conversation_message_id","principal_id","emoji");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_message_translations_unique_idx" ON "quills"."conversation_message_translations" USING btree ("workspace_id","conversation_message_id","locale");--> statement-breakpoint
CREATE INDEX "conversation_message_translations_created_at_idx" ON "quills"."conversation_message_translations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "conversation_messages_workspace_created_idx" ON "quills"."conversation_messages" USING btree ("workspace_thread_key","created_at","id") WHERE "quills"."conversation_messages"."workspace_thread_key" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_messages_workspace_run_sender_idx" ON "quills"."conversation_messages" USING btree ("workspace_id","workspace_thread_key",("metadata"->'workspaceTurn'->>'runId'),"sender_type") WHERE "quills"."conversation_messages"."workspace_thread_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "conversation_messages_conversation_created_idx" ON "quills"."conversation_messages" USING btree ("conversation_id","created_at","id");--> statement-breakpoint
CREATE INDEX "conversation_messages_ticket_created_idx" ON "quills"."conversation_messages" USING btree ("ticket_id","created_at","id");--> statement-breakpoint
CREATE INDEX "conversation_messages_principal_idx" ON "quills"."conversation_messages" USING btree ("principal_id");--> statement-breakpoint
CREATE INDEX "conversation_messages_deleted_by_principal_idx" ON "quills"."conversation_messages" USING btree ("deleted_by_principal_id") WHERE "deleted_by_principal_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "conversation_messages_style_mining_idx" ON "quills"."conversation_messages" USING btree ("principal_id","created_at" DESC NULLS FIRST) WHERE "quills"."conversation_messages"."sender_type" = 'agent' AND "quills"."conversation_messages"."is_internal" = false AND "quills"."conversation_messages"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "conversation_messages_created_at_idx" ON "quills"."conversation_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "conversation_messages_unread_count_idx" ON "quills"."conversation_messages" USING btree ("conversation_id","created_at") WHERE "quills"."conversation_messages"."sender_type" = 'visitor' AND "quills"."conversation_messages"."deleted_at" IS NULL AND "quills"."conversation_messages"."is_internal" = false;--> statement-breakpoint
CREATE INDEX "conversation_messages_search_vector_idx" ON "quills"."conversation_messages" USING gin ("search_vector");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_messages_email_message_id_idx" ON "quills"."conversation_messages" USING btree ((metadata ->> 'emailMessageId')) WHERE (metadata ->> 'emailMessageId') IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_messages_github_comment_id_idx" ON "quills"."conversation_messages" USING btree ((metadata ->> 'githubCommentId')) WHERE (metadata ->> 'githubCommentId') IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_messages_inbound_delivery_key_idx" ON "quills"."conversation_messages" USING btree ("ticket_id",(metadata ->> 'inboundDeliveryKey')) WHERE (metadata ->> 'inboundDeliveryKey') IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_participants_pk" ON "quills"."conversation_participants" USING btree ("workspace_id","conversation_id","principal_id");--> statement-breakpoint
CREATE INDEX "conversation_participants_conversation_id_idx" ON "quills"."conversation_participants" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "conversation_participants_principal_id_idx" ON "quills"."conversation_participants" USING btree ("principal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_tag_assignments_pk" ON "quills"."conversation_tag_assignments" USING btree ("workspace_id","conversation_id","conversation_tag_id");--> statement-breakpoint
CREATE INDEX "conversation_tag_assignments_tag_idx" ON "quills"."conversation_tag_assignments" USING btree ("conversation_tag_id");--> statement-breakpoint
CREATE INDEX "conversation_tags_deleted_at_idx" ON "quills"."conversation_tags" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "conversations_channel_account_id_idx" ON "quills"."conversations" USING btree ("channel_account_id");--> statement-breakpoint
CREATE INDEX "conversations_status_last_message_idx" ON "quills"."conversations" USING btree ("status","last_message_at");--> statement-breakpoint
CREATE INDEX "conversations_last_message_at_id_idx" ON "quills"."conversations" USING btree ("last_message_at" DESC NULLS FIRST,"id");--> statement-breakpoint
CREATE INDEX "conversations_created_at_id_idx" ON "quills"."conversations" USING btree ("created_at" DESC NULLS FIRST,"id");--> statement-breakpoint
CREATE INDEX "conversations_waiting_since_id_idx" ON "quills"."conversations" USING btree ("waiting_since","id");--> statement-breakpoint
CREATE INDEX "conversations_visitor_principal_idx" ON "quills"."conversations" USING btree ("visitor_principal_id");--> statement-breakpoint
CREATE INDEX "conversations_assigned_agent_idx" ON "quills"."conversations" USING btree ("assigned_agent_principal_id");--> statement-breakpoint
CREATE INDEX "conversations_assigned_team_idx" ON "quills"."conversations" USING btree ("assigned_team_id") WHERE assigned_team_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "conversations_snoozed_until_idx" ON "quills"."conversations" USING btree ("snoozed_until") WHERE status = 'snoozed' AND snoozed_until IS NOT NULL;--> statement-breakpoint
CREATE INDEX "conversations_spam_resolved_at_idx" ON "quills"."conversations" USING btree ("resolved_at") WHERE status = 'closed' AND end_reason = 'spam';--> statement-breakpoint
CREATE INDEX "conversations_sla_unsettled_idx" ON "quills"."conversations" USING btree ("id") WHERE sla_applied IS NOT NULL AND ((sla_applied ->> 'firstResponseAt') IS NULL OR (sla_applied ->> 'resolvedAt') IS NULL OR ((sla_applied ->> 'nextResponseDueAt') IS NOT NULL AND (sla_applied ->> 'nextResponseAt') IS NULL));--> statement-breakpoint
CREATE INDEX "conversation_summaries_visitor_principal_id_idx" ON "quills"."conversation_summaries" USING btree ("visitor_principal_id");--> statement-breakpoint
CREATE INDEX "conversation_view_pins_view_idx" ON "quills"."conversation_view_pins" USING btree ("view_id");--> statement-breakpoint
CREATE INDEX "conversation_views_shared_idx" ON "quills"."conversation_views" USING btree ("is_shared") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_attribute_definitions_key_idx" ON "quills"."conversation_attribute_definitions" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_principal_team_uq" ON "quills"."team_members" USING btree ("workspace_id","principal_id","team_id");--> statement-breakpoint
CREATE INDEX "team_members_team_idx" ON "quills"."team_members" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "teams_is_default_idx" ON "quills"."teams" USING btree ("id") WHERE is_default = true AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "ticket_conversations_conversation_idx" ON "quills"."ticket_conversations" USING btree ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_conversations_customer_uq" ON "quills"."ticket_conversations" USING btree ("workspace_id","conversation_id") WHERE ticket_type = 'customer';--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_conversations_customer_ticket_uq" ON "quills"."ticket_conversations" USING btree ("workspace_id","ticket_id") WHERE ticket_type = 'customer';--> statement-breakpoint
CREATE INDEX "ticket_links_linked_ticket_idx" ON "quills"."ticket_links" USING btree ("linked_ticket_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_links_tracks_uq" ON "quills"."ticket_links" USING btree ("workspace_id","linked_ticket_id") WHERE relation = 'tracks';--> statement-breakpoint
CREATE INDEX "ticket_statuses_position_idx" ON "quills"."ticket_statuses" USING btree ("category","position");--> statement-breakpoint
CREATE INDEX "ticket_statuses_deleted_at_idx" ON "quills"."ticket_statuses" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_number_uq" ON "quills"."tickets" USING btree ("workspace_id","number");--> statement-breakpoint
CREATE INDEX "tickets_status_id_idx" ON "quills"."tickets" USING btree ("status_id");--> statement-breakpoint
CREATE INDEX "tickets_assignee_principal_id_idx" ON "quills"."tickets" USING btree ("assignee_principal_id");--> statement-breakpoint
CREATE INDEX "tickets_assignee_team_idx" ON "quills"."tickets" USING btree ("assignee_team_id") WHERE "assignee_team_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "tickets_requester_principal_id_idx" ON "quills"."tickets" USING btree ("requester_principal_id");--> statement-breakpoint
CREATE INDEX "tickets_company_id_idx" ON "quills"."tickets" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "tickets_type_status_id_idx" ON "quills"."tickets" USING btree ("type","status_id");--> statement-breakpoint
CREATE INDEX "tickets_ticket_type_id_idx" ON "quills"."tickets" USING btree ("ticket_type_id");--> statement-breakpoint
CREATE INDEX "tickets_updated_at_id_idx" ON "quills"."tickets" USING btree ("updated_at" DESC NULLS FIRST,"id");--> statement-breakpoint
CREATE INDEX "tickets_created_at_id_idx" ON "quills"."tickets" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "tickets_sla_unsettled_idx" ON "quills"."tickets" USING btree ("id") WHERE "quills"."tickets"."sla_applied" IS NOT NULL AND ("quills"."tickets"."sla_applied" ->> 'resolvedAt') IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_types_one_default_per_category_uq" ON "quills"."ticket_types" USING btree ("workspace_id","category") WHERE is_default = true AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "ticket_summaries_requester_principal_id_idx" ON "quills"."ticket_summaries" USING btree ("requester_principal_id");--> statement-breakpoint
CREATE INDEX "ticket_summaries_embedding_hnsw_idx" ON "quills"."ticket_summaries" USING hnsw ("embedding" vector_cosine_ops) WHERE "quills"."ticket_summaries"."embedding" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_subscriptions_unique" ON "quills"."ticket_subscriptions" USING btree ("workspace_id","ticket_id","principal_id");--> statement-breakpoint
CREATE INDEX "ticket_subscriptions_ticket_idx" ON "quills"."ticket_subscriptions" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "ticket_subscriptions_principal_idx" ON "quills"."ticket_subscriptions" USING btree ("principal_id");--> statement-breakpoint
CREATE INDEX "ticket_activity_ticket_id_created_idx" ON "quills"."ticket_activity" USING btree ("ticket_id","created_at");--> statement-breakpoint
CREATE INDEX "ticket_activity_type_idx" ON "quills"."ticket_activity" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_accounts_one_inbound_uq" ON "quills"."channel_accounts" USING btree ("workspace_id","owning_team_id") WHERE role = 'inbound' AND channel = 'email' AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_accounts_one_github_connection_uq" ON "quills"."channel_accounts" USING btree ("workspace_id","owning_team_id") WHERE role = 'connection' AND channel = 'github' AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_accounts_sending_address_uq" ON "quills"."channel_accounts" USING btree ("workspace_id","owning_team_id","channel","address") WHERE address IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "channel_accounts_team_role_idx" ON "quills"."channel_accounts" USING btree ("owning_team_id","role") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "email_sending_domains_team_domain_unique" ON "quills"."email_sending_domains" USING btree ("workspace_id","owning_team_id","domain");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_threads_account_key_uq" ON "quills"."channel_threads" USING btree ("workspace_id","channel_account_id","external_thread_key");--> statement-breakpoint
CREATE INDEX "channel_threads_conversation_idx" ON "quills"."channel_threads" USING btree ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "office_hours_one_default_uq" ON "quills"."office_hours_schedules" USING btree ("workspace_id","is_default") WHERE is_default = true;--> statement-breakpoint
CREATE INDEX "sla_events_conversation_at_idx" ON "quills"."sla_events" USING btree ("conversation_id","at");--> statement-breakpoint
CREATE INDEX "sla_events_ticket_at_idx" ON "quills"."sla_events" USING btree ("ticket_id","at");--> statement-breakpoint
CREATE INDEX "sla_events_policy_at_idx" ON "quills"."sla_events" USING btree ("policy_id","at");--> statement-breakpoint
CREATE INDEX "workflow_run_events_cap_idx" ON "quills"."workflow_run_events" USING btree ("workflow_id","subject_principal_id","at");--> statement-breakpoint
CREATE INDEX "workflow_run_events_run_idx" ON "quills"."workflow_run_events" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "workflow_runs_conversation_state_idx" ON "quills"."workflow_runs" USING btree ("conversation_id","state") WHERE "conversation_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "workflow_runs_state_idx" ON "quills"."workflow_runs" USING btree ("state");--> statement-breakpoint
CREATE INDEX "workflow_runs_workflow_idx" ON "quills"."workflow_runs" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_runs_started_at_idx" ON "quills"."workflow_runs" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_runs_exclusive_customer_facing_idx" ON "quills"."workflow_runs" USING btree ("workspace_id","conversation_id") WHERE "state" IN ('running', 'waiting') AND "customer_facing";--> statement-breakpoint
CREATE INDEX "workflow_versions_workflow_created_idx" ON "quills"."workflow_versions" USING btree ("workflow_id","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "workflows_trigger_status_order_idx" ON "quills"."workflows" USING btree ("trigger_type","status","sort_order");--> statement-breakpoint
CREATE INDEX "channel_identities_principal_idx" ON "quills"."channel_identities" USING btree ("principal_id");--> statement-breakpoint
CREATE INDEX "conversation_outbound_emails_conversation_idx" ON "quills"."conversation_outbound_emails" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "in_app_notifications_principal_created_idx" ON "quills"."in_app_notifications" USING btree ("principal_id","created_at");--> statement-breakpoint
CREATE INDEX "in_app_notifications_principal_unread_idx" ON "quills"."in_app_notifications" USING btree ("principal_id") WHERE read_at IS NULL AND archived_at IS NULL;--> statement-breakpoint
CREATE INDEX "in_app_notifications_post_idx" ON "quills"."in_app_notifications" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "in_app_notifications_comment_idx" ON "quills"."in_app_notifications" USING btree ("comment_id") WHERE "comment_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "post_subscriptions_unique" ON "quills"."post_subscriptions" USING btree ("workspace_id","post_id","principal_id");--> statement-breakpoint
CREATE INDEX "post_subscriptions_principal_idx" ON "quills"."post_subscriptions" USING btree ("principal_id");--> statement-breakpoint
CREATE INDEX "post_subscriptions_post_comments_idx" ON "quills"."post_subscriptions" USING btree ("post_id") WHERE notify_comments = true;--> statement-breakpoint
CREATE INDEX "post_subscriptions_post_status_idx" ON "quills"."post_subscriptions" USING btree ("post_id") WHERE notify_status_changes = true;--> statement-breakpoint
CREATE INDEX "unsubscribe_tokens_principal_idx" ON "quills"."unsubscribe_tokens" USING btree ("principal_id");--> statement-breakpoint
CREATE INDEX "post_sentiment_processed_at_idx" ON "quills"."post_sentiment" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX "post_sentiment_sentiment_idx" ON "quills"."post_sentiment" USING btree ("sentiment");--> statement-breakpoint
CREATE INDEX "api_keys_created_by_id_idx" ON "quills"."api_keys" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "api_keys_principal_id_idx" ON "quills"."api_keys" USING btree ("principal_id");--> statement-breakpoint
CREATE INDEX "api_keys_revoked_at_idx" ON "quills"."api_keys" USING btree ("revoked_at");--> statement-breakpoint
CREATE INDEX "webhooks_status_idx" ON "quills"."webhooks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "webhooks_created_by_id_idx" ON "quills"."webhooks" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "webhooks_deleted_at_idx" ON "quills"."webhooks" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "post_external_links_post_status_idx" ON "quills"."post_external_links" USING btree ("post_id","status");--> statement-breakpoint
CREATE INDEX "ticket_external_links_type_external_id_idx" ON "quills"."ticket_external_links" USING btree ("integration_type","external_id");--> statement-breakpoint
CREATE INDEX "ticket_external_links_ticket_status_idx" ON "quills"."ticket_external_links" USING btree ("ticket_id","status");--> statement-breakpoint
CREATE INDEX "segments_type_idx" ON "quills"."segments" USING btree ("type");--> statement-breakpoint
CREATE INDEX "segments_deleted_at_idx" ON "quills"."segments" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "segments_slug_unique" ON "quills"."segments" USING btree ("workspace_id","slug") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_segments_pk" ON "quills"."user_segments" USING btree ("workspace_id","principal_id","segment_id");--> statement-breakpoint
CREATE INDEX "user_segments_segment_id_idx" ON "quills"."user_segments" USING btree ("segment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_attr_key_idx" ON "quills"."user_attribute_definitions" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "user_tag_assignments_pk" ON "quills"."user_tag_assignments" USING btree ("workspace_id","principal_id","tag_id");--> statement-breakpoint
CREATE INDEX "user_tag_assignments_tag_id_idx" ON "quills"."user_tag_assignments" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "user_tags_deleted_at_idx" ON "quills"."user_tags" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "post_merge_suggestions_source_post_idx" ON "quills"."post_merge_suggestions" USING btree ("source_post_id");--> statement-breakpoint
CREATE INDEX "post_merge_suggestions_target_post_idx" ON "quills"."post_merge_suggestions" USING btree ("target_post_id");--> statement-breakpoint
CREATE INDEX "post_merge_suggestions_status_idx" ON "quills"."post_merge_suggestions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "post_merge_suggestions_created_idx" ON "quills"."post_merge_suggestions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "post_merge_suggestions_pending_unique_idx" ON "quills"."post_merge_suggestions" USING btree ("workspace_id","source_post_id","target_post_id") WHERE "quills"."post_merge_suggestions"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "post_activity_post_id_created_idx" ON "quills"."post_activity" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE INDEX "post_activity_type_idx" ON "quills"."post_activity" USING btree ("type");--> statement-breakpoint
CREATE INDEX "ai_usage_log_step_idx" ON "quills"."ai_usage_log" USING btree ("pipeline_step");--> statement-breakpoint
CREATE INDEX "ai_usage_log_created_idx" ON "quills"."ai_usage_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_log_raw_item_idx" ON "quills"."ai_usage_log" USING btree ("raw_feedback_item_id");--> statement-breakpoint
CREATE INDEX "ai_usage_log_month_chat_idx" ON "quills"."ai_usage_log" USING btree ("created_at") WHERE "call_type" = 'chat_completion' AND "status" = 'success';--> statement-breakpoint
CREATE INDEX "email_log_created_idx" ON "quills"."email_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "email_log_conversation_idx" ON "quills"."email_log" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "email_log_month_billable_idx" ON "quills"."email_log" USING btree ("created_at") WHERE "direction" = 'outbound' AND "status" = 'sent' AND "billable" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "kb_article_feedback_unique_idx" ON "quills"."kb_article_feedback" USING btree ("workspace_id","article_id","principal_id");--> statement-breakpoint
CREATE INDEX "kb_article_feedback_reason_idx" ON "quills"."kb_article_feedback" USING btree ("article_id","created_at") WHERE "quills"."kb_article_feedback"."reason" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "kb_article_translations_unique_idx" ON "quills"."kb_article_translations" USING btree ("workspace_id","article_id","locale");--> statement-breakpoint
CREATE INDEX "kb_article_translations_locale_idx" ON "quills"."kb_article_translations" USING btree ("locale");--> statement-breakpoint
CREATE INDEX "kb_article_translations_search_vector_idx" ON "quills"."kb_article_translations" USING gin ("search_vector");--> statement-breakpoint
CREATE UNIQUE INDEX "kb_articles_slug_idx" ON "quills"."kb_articles" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "kb_articles_url_id_idx" ON "quills"."kb_articles" USING btree ("workspace_id","url_id");--> statement-breakpoint
CREATE INDEX "kb_articles_principal_id_idx" ON "quills"."kb_articles" USING btree ("principal_id");--> statement-breakpoint
CREATE INDEX "kb_articles_published_at_idx" ON "quills"."kb_articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "kb_articles_deleted_at_idx" ON "quills"."kb_articles" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "kb_articles_category_published_idx" ON "quills"."kb_articles" USING btree ("category_id","published_at");--> statement-breakpoint
CREATE INDEX "kb_articles_category_position_idx" ON "quills"."kb_articles" USING btree ("category_id","position");--> statement-breakpoint
CREATE INDEX "kb_articles_search_vector_idx" ON "quills"."kb_articles" USING gin ("search_vector");--> statement-breakpoint
CREATE UNIQUE INDEX "kb_categories_slug_idx" ON "quills"."kb_categories" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "kb_categories_url_id_idx" ON "quills"."kb_categories" USING btree ("workspace_id","url_id");--> statement-breakpoint
CREATE INDEX "kb_categories_position_idx" ON "quills"."kb_categories" USING btree ("position");--> statement-breakpoint
CREATE INDEX "kb_categories_deleted_at_idx" ON "quills"."kb_categories" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "kb_categories_parent_id_idx" ON "quills"."kb_categories" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kb_category_translations_unique_idx" ON "quills"."kb_category_translations" USING btree ("workspace_id","category_id","locale");--> statement-breakpoint
CREATE INDEX "kb_category_translations_locale_idx" ON "quills"."kb_category_translations" USING btree ("locale");--> statement-breakpoint
CREATE UNIQUE INDEX "hc_redirect_rules_path_idx" ON "quills"."hc_redirect_rules" USING btree ("workspace_id","path");--> statement-breakpoint
CREATE INDEX "hc_redirect_rules_target_idx" ON "quills"."hc_redirect_rules" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "kb_search_queries_created_at_idx" ON "quills"."kb_search_queries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "page_views_path_occurred_idx" ON "quills"."page_views" USING btree ("path","occurred_at");--> statement-breakpoint
CREATE INDEX "page_views_device_id_idx" ON "quills"."page_views" USING btree ("device_id") WHERE "device_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "page_views_principal_id_idx" ON "quills"."page_views" USING btree ("principal_id") WHERE "principal_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "visitor_devices_principal_idx" ON "quills"."visitor_devices" USING btree ("principal_id") WHERE "principal_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "hook_deliveries_processed_at_idx" ON "quills"."hook_deliveries" USING btree ("processed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "events_event_id_idx" ON "quills"."events" USING btree ("workspace_id","event_id");--> statement-breakpoint
CREATE INDEX "events_unpublished_idx" ON "quills"."events" USING btree ("id") WHERE "quills"."events"."published_at" IS NULL;--> statement-breakpoint
CREATE INDEX "events_entity_idx" ON "quills"."events" USING btree ("entity_type","entity_id","id");--> statement-breakpoint
CREATE INDEX "events_type_idx" ON "quills"."events" USING btree ("type","id");--> statement-breakpoint
CREATE UNIQUE INDEX "events_dedupe_idx" ON "quills"."events" USING btree ("workspace_id","dedupe_key") WHERE "quills"."events"."dedupe_key" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "job_queue_job_id_idx" ON "quills"."job_queue" USING btree ("workspace_id","job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_queue_dedupe_idx" ON "quills"."job_queue" USING btree ("workspace_id","queue","dedupe_key") WHERE "quills"."job_queue"."dedupe_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "job_queue_claim_idx" ON "quills"."job_queue" USING btree ("queue","run_at","id") WHERE "quills"."job_queue"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "job_queue_lease_idx" ON "quills"."job_queue" USING btree ("locked_until") WHERE "quills"."job_queue"."status" = 'running';--> statement-breakpoint
CREATE INDEX "job_queue_terminal_idx" ON "quills"."job_queue" USING btree ("finished_at") WHERE "quills"."job_queue"."status" IN ('succeeded', 'failed');--> statement-breakpoint
CREATE INDEX "kv_set_member_expires_at_idx" ON "quills"."kv_set_member" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "kv_store_expires_at_idx" ON "quills"."kv_store" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "presence_stream_heartbeat_idx" ON "quills"."presence_stream" USING btree ("heartbeat_at");--> statement-breakpoint
CREATE INDEX "rate_bucket_window_expires_at_idx" ON "quills"."rate_bucket" USING btree ("window_expires_at");--> statement-breakpoint
CREATE INDEX "realtime_overflow_expires_at_idx" ON "quills"."realtime_overflow" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "apps_oauth_client_id_idx" ON "quills"."apps" USING btree ("workspace_id","oauth_client_id");--> statement-breakpoint
CREATE INDEX "apps_status_idx" ON "quills"."apps" USING btree ("status");--> statement-breakpoint
CREATE INDEX "apps_subscribed_events_idx" ON "quills"."apps" USING gin ("subscribed_event_types");--> statement-breakpoint
CREATE INDEX "audit_log_occurred_at_idx" ON "quills"."audit_log" USING btree ("occurred_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "audit_log_actor_user_id_occurred_at_idx" ON "quills"."audit_log" USING btree ("actor_user_id","occurred_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "audit_log_event_type_occurred_at_idx" ON "quills"."audit_log" USING btree ("event_type","occurred_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX "audit_log_request_id_idx" ON "quills"."audit_log" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "push_devices_token_idx" ON "quills"."push_devices" USING btree ("workspace_id","token");--> statement-breakpoint
CREATE INDEX "push_devices_principal_idx" ON "quills"."push_devices" USING btree ("principal_id");--> statement-breakpoint
CREATE INDEX "assistant_documents_embedding_hnsw_idx" ON "quills"."assistant_documents" USING hnsw ("embedding" vector_cosine_ops) WHERE "quills"."assistant_documents"."embedding" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "assistant_involvements_conversation_id_idx" ON "quills"."assistant_involvements" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "assistant_involvements_active_answer_idx" ON "quills"."assistant_involvements" USING btree ("last_assistant_answer_at") WHERE "quills"."assistant_involvements"."status" = 'active';--> statement-breakpoint
CREATE INDEX "assistant_involvements_created_at_idx" ON "quills"."assistant_involvements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "assistant_snippets_enabled_audience_idx" ON "quills"."assistant_snippets" USING btree ("enabled","audience");--> statement-breakpoint
CREATE UNIQUE INDEX "files_storage_key_idx" ON "quills"."files" USING btree ("workspace_id","storage_key");--> statement-breakpoint
CREATE INDEX "files_message_id_idx" ON "quills"."files" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "files_unattached_created_at_idx" ON "quills"."files" USING btree ("created_at") WHERE "quills"."files"."attached_at" IS NULL AND "quills"."files"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "assistant_guidance_rules_enabled_priority_idx" ON "quills"."assistant_guidance_rules" USING btree ("enabled","priority");--> statement-breakpoint
CREATE INDEX "assistant_pending_actions_conversation_proposed_idx" ON "quills"."assistant_pending_actions" USING btree ("conversation_id") WHERE "quills"."assistant_pending_actions"."status" = 'proposed' AND "quills"."assistant_pending_actions"."conversation_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "assistant_pending_actions_ticket_proposed_idx" ON "quills"."assistant_pending_actions" USING btree ("ticket_id") WHERE "quills"."assistant_pending_actions"."status" = 'proposed' AND "quills"."assistant_pending_actions"."ticket_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "assistant_pending_actions_proposed_at_idx" ON "quills"."assistant_pending_actions" USING btree ("proposed_at");--> statement-breakpoint
CREATE INDEX "assistant_pending_actions_waiting_idx" ON "quills"."assistant_pending_actions" USING btree ("proposed_at" DESC NULLS FIRST) WHERE "quills"."assistant_pending_actions"."status" = 'proposed';--> statement-breakpoint
CREATE INDEX "assistant_pending_actions_decided_idx" ON "quills"."assistant_pending_actions" USING btree ("decided_at" DESC NULLS FIRST) WHERE "quills"."assistant_pending_actions"."decided_at" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_pending_actions_idempotency_key_idx" ON "quills"."assistant_pending_actions" USING btree ("workspace_id","idempotency_key") WHERE "quills"."assistant_pending_actions"."idempotency_key" IS NOT NULL AND "quills"."assistant_pending_actions"."status" = 'proposed';--> statement-breakpoint
CREATE INDEX "assistant_tool_calls_conversation_id_created_at_idx" ON "quills"."assistant_tool_calls" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "assistant_tool_calls_status_created_at_idx" ON "quills"."assistant_tool_calls" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "assistant_tool_calls_created_at_idx" ON "quills"."assistant_tool_calls" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_tool_calls_idempotency_key_idx" ON "quills"."assistant_tool_calls" USING btree ("workspace_id","idempotency_key") WHERE "quills"."assistant_tool_calls"."idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "assistant_events_event_type_created_at_idx" ON "quills"."assistant_events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE INDEX "assistant_events_conversation_idx" ON "quills"."assistant_events" USING btree ("conversation_id") WHERE "conversation_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "assistant_events_ticket_idx" ON "quills"."assistant_events" USING btree ("ticket_id") WHERE "ticket_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "connectors_slug_lower_unique" ON "quills"."connectors" USING btree ("workspace_id",lower("slug"));--> statement-breakpoint
CREATE UNIQUE INDEX "connectors_name_lower_unique" ON "quills"."connectors" USING btree ("workspace_id",lower("name"));--> statement-breakpoint
CREATE INDEX "connectors_enabled_idx" ON "quills"."connectors" USING btree ("enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_skills_name_lower_unique" ON "quills"."agent_skills" USING btree ("workspace_id",lower("name"));--> statement-breakpoint
CREATE INDEX "agent_skills_enabled_idx" ON "quills"."agent_skills" USING btree ("enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_web_sources_url_uidx" ON "quills"."assistant_web_sources" USING btree ("workspace_id","url");--> statement-breakpoint
CREATE INDEX "assistant_web_sources_enabled_idx" ON "quills"."assistant_web_sources" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "import_runs_status_idx" ON "quills"."import_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "import_runs_created_at_idx" ON "quills"."import_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "export_runs_status_idx" ON "quills"."export_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "export_runs_created_at_idx" ON "quills"."export_runs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "export_runs_active_idx" ON "quills"."export_runs" USING btree ("workspace_id",(1)) WHERE "status" IN ('pending', 'running');--> statement-breakpoint
CREATE INDEX "slack_thread_sessions_last_event_idx" ON "quills"."slack_thread_sessions" USING btree ("last_event_at");--> statement-breakpoint
CREATE INDEX "integration_deliveries_received_idx" ON "quills"."integration_deliveries" USING btree ("received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_sync_attempt_token_idx" ON "quills"."integration_sync_attempts" USING btree ("workspace_id","token");--> statement-breakpoint
CREATE INDEX "integration_sync_attempt_operation_idx" ON "quills"."integration_sync_attempts" USING btree ("operation_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_sync_operation_key_idx" ON "quills"."integration_sync_operations" USING btree ("workspace_id","operation_key");--> statement-breakpoint
CREATE INDEX "integration_sync_history_idx" ON "quills"."integration_sync_operations" USING btree ("provider","created_at","id");--> statement-breakpoint
CREATE INDEX "integration_sync_attention_idx" ON "quills"."integration_sync_operations" USING btree ("integration_id","installation","state");--> statement-breakpoint
CREATE INDEX "integration_sync_success_idx" ON "quills"."integration_sync_operations" USING btree ("integration_id","installation","direction","finished_at") WHERE "quills"."integration_sync_operations"."state" = 'succeeded';--> statement-breakpoint
CREATE INDEX "integration_sync_source_idx" ON "quills"."integration_sync_operations" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "integration_sync_source_record_idx" ON "quills"."integration_sync_operations" USING btree ("source_type","source_record_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_sync_remote_running_idx" ON "quills"."integration_sync_operations" USING btree ("workspace_id","installation","destination_key","remote_id") WHERE "quills"."integration_sync_operations"."state" = 'running' AND "quills"."integration_sync_operations"."remote_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "workspace_assistant_threads_owner_updated_idx" ON "quills"."workspace_assistant_threads" USING btree ("owner_principal_id","updated_at","key");--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_emails_principal_kind_idx" ON "quills"."onboarding_emails" USING btree ("workspace_id","principal_id","kind");--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."oauth_client" AS PERMISSIVE FOR ALL TO public USING ("quills"."oauth_client"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."oauth_client"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."principal" AS PERMISSIVE FOR ALL TO public USING ("quills"."principal"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."principal"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."settings" AS PERMISSIVE FOR ALL TO public USING ("quills"."settings"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."settings"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."customer_identity" AS PERMISSIVE FOR ALL TO public USING ("quills"."customer_identity"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."customer_identity"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."widget_identified_session" AS PERMISSIVE FOR ALL TO public USING ("quills"."widget_identified_session"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."widget_identified_session"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."widget_origin_session" AS PERMISSIVE FOR ALL TO public USING ("quills"."widget_origin_session"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."widget_origin_session"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."permissions" AS PERMISSIVE FOR ALL TO public USING ("quills"."permissions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."permissions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."principal_role_assignments" AS PERMISSIVE FOR ALL TO public USING ("quills"."principal_role_assignments"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."principal_role_assignments"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."role_permissions" AS PERMISSIVE FOR ALL TO public USING ("quills"."role_permissions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."role_permissions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."roles" AS PERMISSIVE FOR ALL TO public USING ("quills"."roles"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."roles"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."boards" AS PERMISSIVE FOR ALL TO public USING ("quills"."boards"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."boards"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."post_tags" AS PERMISSIVE FOR ALL TO public USING ("quills"."post_tags"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."post_tags"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."roadmap_columns" AS PERMISSIVE FOR ALL TO public USING ("quills"."roadmap_columns"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."roadmap_columns"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."roadmaps" AS PERMISSIVE FOR ALL TO public USING ("quills"."roadmaps"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."roadmaps"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."post_statuses" AS PERMISSIVE FOR ALL TO public USING ("quills"."post_statuses"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."post_statuses"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."post_comment_edit_history" AS PERMISSIVE FOR ALL TO public USING ("quills"."post_comment_edit_history"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."post_comment_edit_history"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."post_comment_reactions" AS PERMISSIVE FOR ALL TO public USING ("quills"."post_comment_reactions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."post_comment_reactions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."post_comments" AS PERMISSIVE FOR ALL TO public USING ("quills"."post_comments"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."post_comments"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."post_edit_history" AS PERMISSIVE FOR ALL TO public USING ("quills"."post_edit_history"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."post_edit_history"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."post_notes" AS PERMISSIVE FOR ALL TO public USING ("quills"."post_notes"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."post_notes"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."post_tag_assignments" AS PERMISSIVE FOR ALL TO public USING ("quills"."post_tag_assignments"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."post_tag_assignments"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."post_votes" AS PERMISSIVE FOR ALL TO public USING ("quills"."post_votes"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."post_votes"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."posts" AS PERMISSIVE FOR ALL TO public USING ("quills"."posts"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."posts"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."companies" AS PERMISSIVE FOR ALL TO public USING ("quills"."companies"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."companies"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."company_attribute_definitions" AS PERMISSIVE FOR ALL TO public USING ("quills"."company_attribute_definitions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."company_attribute_definitions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."post_mentions" AS PERMISSIVE FOR ALL TO public USING ("quills"."post_mentions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."post_mentions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."post_views" AS PERMISSIVE FOR ALL TO public USING ("quills"."post_views"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."post_views"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."integration_event_mappings" AS PERMISSIVE FOR ALL TO public USING ("quills"."integration_event_mappings"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."integration_event_mappings"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."integration_platform_credentials" AS PERMISSIVE FOR ALL TO public USING ("quills"."integration_platform_credentials"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."integration_platform_credentials"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."integrations" AS PERMISSIVE FOR ALL TO public USING ("quills"."integrations"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."integrations"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."changelog_entries" AS PERMISSIVE FOR ALL TO public USING ("quills"."changelog_entries"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."changelog_entries"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."changelog_entry_posts" AS PERMISSIVE FOR ALL TO public USING ("quills"."changelog_entry_posts"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."changelog_entry_posts"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."changelog_categories" AS PERMISSIVE FOR ALL TO public USING ("quills"."changelog_categories"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."changelog_categories"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."changelog_entry_categories" AS PERMISSIVE FOR ALL TO public USING ("quills"."changelog_entry_categories"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."changelog_entry_categories"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."changelog_subscriptions" AS PERMISSIVE FOR ALL TO public USING ("quills"."changelog_subscriptions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."changelog_subscriptions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."status_component_events" AS PERMISSIVE FOR ALL TO public USING ("quills"."status_component_events"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."status_component_events"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."status_component_groups" AS PERMISSIVE FOR ALL TO public USING ("quills"."status_component_groups"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."status_component_groups"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."status_components" AS PERMISSIVE FOR ALL TO public USING ("quills"."status_components"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."status_components"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."status_incident_components" AS PERMISSIVE FOR ALL TO public USING ("quills"."status_incident_components"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."status_incident_components"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."status_incident_templates" AS PERMISSIVE FOR ALL TO public USING ("quills"."status_incident_templates"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."status_incident_templates"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."status_incident_updates" AS PERMISSIVE FOR ALL TO public USING ("quills"."status_incident_updates"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."status_incident_updates"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."status_incidents" AS PERMISSIVE FOR ALL TO public USING ("quills"."status_incidents"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."status_incidents"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."status_subscriptions" AS PERMISSIVE FOR ALL TO public USING ("quills"."status_subscriptions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."status_subscriptions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."conversation_message_flags" AS PERMISSIVE FOR ALL TO public USING ("quills"."conversation_message_flags"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."conversation_message_flags"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."conversation_message_mentions" AS PERMISSIVE FOR ALL TO public USING ("quills"."conversation_message_mentions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."conversation_message_mentions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."conversation_message_reactions" AS PERMISSIVE FOR ALL TO public USING ("quills"."conversation_message_reactions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."conversation_message_reactions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."conversation_message_translations" AS PERMISSIVE FOR ALL TO public USING ("quills"."conversation_message_translations"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."conversation_message_translations"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."conversation_messages" AS PERMISSIVE FOR ALL TO public USING ("quills"."conversation_messages"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."conversation_messages"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."conversation_participants" AS PERMISSIVE FOR ALL TO public USING ("quills"."conversation_participants"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."conversation_participants"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."conversation_tag_assignments" AS PERMISSIVE FOR ALL TO public USING ("quills"."conversation_tag_assignments"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."conversation_tag_assignments"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."conversation_tags" AS PERMISSIVE FOR ALL TO public USING ("quills"."conversation_tags"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."conversation_tags"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."conversations" AS PERMISSIVE FOR ALL TO public USING ("quills"."conversations"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."conversations"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."conversation_summaries" AS PERMISSIVE FOR ALL TO public USING ("quills"."conversation_summaries"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."conversation_summaries"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."conversation_view_pins" AS PERMISSIVE FOR ALL TO public USING ("quills"."conversation_view_pins"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."conversation_view_pins"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."conversation_views" AS PERMISSIVE FOR ALL TO public USING ("quills"."conversation_views"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."conversation_views"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."conversation_attribute_definitions" AS PERMISSIVE FOR ALL TO public USING ("quills"."conversation_attribute_definitions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."conversation_attribute_definitions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."team_members" AS PERMISSIVE FOR ALL TO public USING ("quills"."team_members"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."team_members"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."teams" AS PERMISSIVE FOR ALL TO public USING ("quills"."teams"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."teams"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."ticket_conversations" AS PERMISSIVE FOR ALL TO public USING ("quills"."ticket_conversations"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."ticket_conversations"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."ticket_links" AS PERMISSIVE FOR ALL TO public USING ("quills"."ticket_links"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."ticket_links"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."ticket_statuses" AS PERMISSIVE FOR ALL TO public USING ("quills"."ticket_statuses"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."ticket_statuses"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."tickets" AS PERMISSIVE FOR ALL TO public USING ("quills"."tickets"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."tickets"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."ticket_types" AS PERMISSIVE FOR ALL TO public USING ("quills"."ticket_types"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."ticket_types"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."ticket_summaries" AS PERMISSIVE FOR ALL TO public USING ("quills"."ticket_summaries"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."ticket_summaries"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."ticket_subscriptions" AS PERMISSIVE FOR ALL TO public USING ("quills"."ticket_subscriptions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."ticket_subscriptions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."ticket_activity" AS PERMISSIVE FOR ALL TO public USING ("quills"."ticket_activity"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."ticket_activity"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."channel_accounts" AS PERMISSIVE FOR ALL TO public USING ("quills"."channel_accounts"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."channel_accounts"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."email_sending_domains" AS PERMISSIVE FOR ALL TO public USING ("quills"."email_sending_domains"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."email_sending_domains"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."email_ses_tenants" AS PERMISSIVE FOR ALL TO public USING ("quills"."email_ses_tenants"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."email_ses_tenants"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."channel_threads" AS PERMISSIVE FOR ALL TO public USING ("quills"."channel_threads"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."channel_threads"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."office_hours_schedules" AS PERMISSIVE FOR ALL TO public USING ("quills"."office_hours_schedules"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."office_hours_schedules"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."sla_events" AS PERMISSIVE FOR ALL TO public USING ("quills"."sla_events"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."sla_events"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."sla_policies" AS PERMISSIVE FOR ALL TO public USING ("quills"."sla_policies"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."sla_policies"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."workflow_run_events" AS PERMISSIVE FOR ALL TO public USING ("quills"."workflow_run_events"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."workflow_run_events"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."workflow_runs" AS PERMISSIVE FOR ALL TO public USING ("quills"."workflow_runs"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."workflow_runs"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."workflow_versions" AS PERMISSIVE FOR ALL TO public USING ("quills"."workflow_versions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."workflow_versions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."workflows" AS PERMISSIVE FOR ALL TO public USING ("quills"."workflows"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."workflows"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."channel_identities" AS PERMISSIVE FOR ALL TO public USING ("quills"."channel_identities"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."channel_identities"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."conversation_outbound_emails" AS PERMISSIVE FOR ALL TO public USING ("quills"."conversation_outbound_emails"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."conversation_outbound_emails"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."in_app_notifications" AS PERMISSIVE FOR ALL TO public USING ("quills"."in_app_notifications"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."in_app_notifications"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."notification_preferences" AS PERMISSIVE FOR ALL TO public USING ("quills"."notification_preferences"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."notification_preferences"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."post_subscriptions" AS PERMISSIVE FOR ALL TO public USING ("quills"."post_subscriptions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."post_subscriptions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."unsubscribe_tokens" AS PERMISSIVE FOR ALL TO public USING ("quills"."unsubscribe_tokens"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."unsubscribe_tokens"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."post_sentiment" AS PERMISSIVE FOR ALL TO public USING ("quills"."post_sentiment"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."post_sentiment"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."api_keys" AS PERMISSIVE FOR ALL TO public USING ("quills"."api_keys"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."api_keys"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."webhooks" AS PERMISSIVE FOR ALL TO public USING ("quills"."webhooks"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."webhooks"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."post_external_links" AS PERMISSIVE FOR ALL TO public USING ("quills"."post_external_links"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."post_external_links"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."ticket_external_links" AS PERMISSIVE FOR ALL TO public USING ("quills"."ticket_external_links"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."ticket_external_links"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."segments" AS PERMISSIVE FOR ALL TO public USING ("quills"."segments"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."segments"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."user_segments" AS PERMISSIVE FOR ALL TO public USING ("quills"."user_segments"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."user_segments"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."user_attribute_definitions" AS PERMISSIVE FOR ALL TO public USING ("quills"."user_attribute_definitions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."user_attribute_definitions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."user_tag_assignments" AS PERMISSIVE FOR ALL TO public USING ("quills"."user_tag_assignments"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."user_tag_assignments"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."user_tags" AS PERMISSIVE FOR ALL TO public USING ("quills"."user_tags"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."user_tags"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."post_merge_suggestions" AS PERMISSIVE FOR ALL TO public USING ("quills"."post_merge_suggestions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."post_merge_suggestions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."post_activity" AS PERMISSIVE FOR ALL TO public USING ("quills"."post_activity"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."post_activity"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."ai_usage_log" AS PERMISSIVE FOR ALL TO public USING ("quills"."ai_usage_log"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."ai_usage_log"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."email_log" AS PERMISSIVE FOR ALL TO public USING ("quills"."email_log"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."email_log"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."kb_article_feedback" AS PERMISSIVE FOR ALL TO public USING ("quills"."kb_article_feedback"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."kb_article_feedback"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."kb_article_translations" AS PERMISSIVE FOR ALL TO public USING ("quills"."kb_article_translations"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."kb_article_translations"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."kb_articles" AS PERMISSIVE FOR ALL TO public USING ("quills"."kb_articles"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."kb_articles"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."kb_categories" AS PERMISSIVE FOR ALL TO public USING ("quills"."kb_categories"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."kb_categories"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."kb_category_translations" AS PERMISSIVE FOR ALL TO public USING ("quills"."kb_category_translations"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."kb_category_translations"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."hc_redirect_rules" AS PERMISSIVE FOR ALL TO public USING ("quills"."hc_redirect_rules"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."hc_redirect_rules"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."kb_search_queries" AS PERMISSIVE FOR ALL TO public USING ("quills"."kb_search_queries"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."kb_search_queries"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."analytics_daily_stats" AS PERMISSIVE FOR ALL TO public USING ("quills"."analytics_daily_stats"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."analytics_daily_stats"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."analytics_top_posts" AS PERMISSIVE FOR ALL TO public USING ("quills"."analytics_top_posts"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."analytics_top_posts"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."page_views" AS PERMISSIVE FOR ALL TO public USING ("quills"."page_views"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."page_views"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."visitor_devices" AS PERMISSIVE FOR ALL TO public USING ("quills"."visitor_devices"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."visitor_devices"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."visitor_stats_daily" AS PERMISSIVE FOR ALL TO public USING ("quills"."visitor_stats_daily"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."visitor_stats_daily"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."visitor_top_stats" AS PERMISSIVE FOR ALL TO public USING ("quills"."visitor_top_stats"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."visitor_top_stats"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."hook_deliveries" AS PERMISSIVE FOR ALL TO public USING ("quills"."hook_deliveries"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."hook_deliveries"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."events" AS PERMISSIVE FOR ALL TO public USING ("quills"."events"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."events"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."job_queue" AS PERMISSIVE FOR ALL TO public USING ("quills"."job_queue"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."job_queue"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."kv_set_member" AS PERMISSIVE FOR ALL TO public USING ("quills"."kv_set_member"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."kv_set_member"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."kv_store" AS PERMISSIVE FOR ALL TO public USING ("quills"."kv_store"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."kv_store"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."presence_stream" AS PERMISSIVE FOR ALL TO public USING ("quills"."presence_stream"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."presence_stream"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."rate_bucket" AS PERMISSIVE FOR ALL TO public USING ("quills"."rate_bucket"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."rate_bucket"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."realtime_overflow" AS PERMISSIVE FOR ALL TO public USING ("quills"."realtime_overflow"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."realtime_overflow"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."apps" AS PERMISSIVE FOR ALL TO public USING ("quills"."apps"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."apps"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."audit_log" AS PERMISSIVE FOR ALL TO public USING ("quills"."audit_log"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."audit_log"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."push_devices" AS PERMISSIVE FOR ALL TO public USING ("quills"."push_devices"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."push_devices"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."assistant_documents" AS PERMISSIVE FOR ALL TO public USING ("quills"."assistant_documents"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."assistant_documents"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."assistant_involvements" AS PERMISSIVE FOR ALL TO public USING ("quills"."assistant_involvements"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."assistant_involvements"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."assistant_snippets" AS PERMISSIVE FOR ALL TO public USING ("quills"."assistant_snippets"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."assistant_snippets"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."files" AS PERMISSIVE FOR ALL TO public USING ("quills"."files"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."files"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."assistant_guidance_rules" AS PERMISSIVE FOR ALL TO public USING ("quills"."assistant_guidance_rules"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."assistant_guidance_rules"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."assistant_pending_actions" AS PERMISSIVE FOR ALL TO public USING ("quills"."assistant_pending_actions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."assistant_pending_actions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."assistant_tool_calls" AS PERMISSIVE FOR ALL TO public USING ("quills"."assistant_tool_calls"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."assistant_tool_calls"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."assistant_events" AS PERMISSIVE FOR ALL TO public USING ("quills"."assistant_events"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."assistant_events"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."connectors" AS PERMISSIVE FOR ALL TO public USING ("quills"."connectors"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."connectors"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."agent_skills" AS PERMISSIVE FOR ALL TO public USING ("quills"."agent_skills"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."agent_skills"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."assistant_web_sources" AS PERMISSIVE FOR ALL TO public USING ("quills"."assistant_web_sources"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."assistant_web_sources"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."macros" AS PERMISSIVE FOR ALL TO public USING ("quills"."macros"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."macros"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."import_runs" AS PERMISSIVE FOR ALL TO public USING ("quills"."import_runs"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."import_runs"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."export_runs" AS PERMISSIVE FOR ALL TO public USING ("quills"."export_runs"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."export_runs"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."workspace_experiments" AS PERMISSIVE FOR ALL TO public USING ("quills"."workspace_experiments"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."workspace_experiments"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."slack_thread_sessions" AS PERMISSIVE FOR ALL TO public USING ("quills"."slack_thread_sessions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."slack_thread_sessions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."slack_user_links" AS PERMISSIVE FOR ALL TO public USING ("quills"."slack_user_links"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."slack_user_links"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."integration_deliveries" AS PERMISSIVE FOR ALL TO public USING ("quills"."integration_deliveries"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."integration_deliveries"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."integration_sync_actions" AS PERMISSIVE FOR ALL TO public USING ("quills"."integration_sync_actions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."integration_sync_actions"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."integration_sync_attempts" AS PERMISSIVE FOR ALL TO public USING ("quills"."integration_sync_attempts"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."integration_sync_attempts"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."integration_sync_operations" AS PERMISSIVE FOR ALL TO public USING ("quills"."integration_sync_operations"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."integration_sync_operations"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."integration_sync_start" AS PERMISSIVE FOR ALL TO public USING ("quills"."integration_sync_start"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."integration_sync_start"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."workspace_assistant_threads" AS PERMISSIVE FOR ALL TO public USING ("quills"."workspace_assistant_threads"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."workspace_assistant_threads"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."onboarding_emails" AS PERMISSIVE FOR ALL TO public USING ("quills"."onboarding_emails"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."onboarding_emails"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));
--> statement-breakpoint
ALTER TABLE "quills"."oauth_client" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."principal" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."settings" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."customer_identity" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."widget_identified_session" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."widget_origin_session" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."permissions" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."principal_role_assignments" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."role_permissions" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."roles" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."boards" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."post_tags" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."roadmap_columns" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."roadmaps" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."post_statuses" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."post_comment_edit_history" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."post_comment_reactions" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."post_comments" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."post_edit_history" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."post_notes" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."post_tag_assignments" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."post_votes" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."posts" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."companies" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."company_attribute_definitions" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."post_mentions" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."post_views" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."integration_event_mappings" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."integration_platform_credentials" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."integrations" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."changelog_entries" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."changelog_entry_posts" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."changelog_categories" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."changelog_entry_categories" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."changelog_subscriptions" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."status_component_events" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."status_component_groups" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."status_components" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."status_incident_components" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."status_incident_templates" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."status_incident_updates" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."status_incidents" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."status_subscriptions" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."conversation_message_flags" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."conversation_message_mentions" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."conversation_message_reactions" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."conversation_message_translations" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."conversation_messages" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."conversation_participants" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."conversation_tag_assignments" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."conversation_tags" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."conversations" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."conversation_summaries" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."conversation_view_pins" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."conversation_views" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."conversation_attribute_definitions" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."team_members" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."teams" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."ticket_conversations" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."ticket_links" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."ticket_statuses" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."tickets" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."ticket_types" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."ticket_summaries" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."ticket_subscriptions" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."ticket_activity" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."channel_accounts" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."email_sending_domains" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."email_ses_tenants" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."channel_threads" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."office_hours_schedules" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."sla_events" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."sla_policies" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."workflow_run_events" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."workflow_runs" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."workflow_versions" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."workflows" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."channel_identities" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."conversation_outbound_emails" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."in_app_notifications" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."notification_preferences" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."post_subscriptions" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."unsubscribe_tokens" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."post_sentiment" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."api_keys" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."webhooks" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."post_external_links" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."ticket_external_links" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."segments" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."user_segments" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."user_attribute_definitions" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."user_tag_assignments" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."user_tags" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."post_merge_suggestions" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."post_activity" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."ai_usage_log" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."email_log" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."kb_article_feedback" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."kb_article_translations" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."kb_articles" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."kb_categories" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."kb_category_translations" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."hc_redirect_rules" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."kb_search_queries" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."analytics_daily_stats" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."analytics_top_posts" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."page_views" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."visitor_devices" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."visitor_stats_daily" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."visitor_top_stats" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."hook_deliveries" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."events" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."job_queue" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."kv_set_member" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."kv_store" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."presence_stream" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."rate_bucket" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."realtime_overflow" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."apps" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."audit_log" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."push_devices" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."assistant_documents" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."assistant_involvements" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."assistant_snippets" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."files" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."assistant_guidance_rules" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."assistant_pending_actions" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."assistant_tool_calls" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."assistant_events" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."connectors" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."agent_skills" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."assistant_web_sources" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."macros" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."import_runs" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."export_runs" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."workspace_experiments" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."slack_thread_sessions" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."slack_user_links" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."integration_deliveries" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."integration_sync_actions" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."integration_sync_attempts" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."integration_sync_operations" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."integration_sync_start" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."workspace_assistant_threads" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."onboarding_emails" FORCE ROW LEVEL SECURITY;

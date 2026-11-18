ALTER TABLE "integration" ADD COLUMN IF NOT EXISTS "repository_key" text;--> statement-breakpoint
ALTER TABLE "integration" ADD COLUMN IF NOT EXISTS "repository_owner" text;--> statement-breakpoint
ALTER TABLE "integration" ADD COLUMN IF NOT EXISTS "repository_name" text;--> statement-breakpoint
ALTER TABLE "integration" ADD COLUMN IF NOT EXISTS "repository_id" integer;--> statement-breakpoint
ALTER TABLE "integration" ADD COLUMN IF NOT EXISTS "base_url" text;--> statement-breakpoint
ALTER TABLE "workflow_rule" ADD COLUMN IF NOT EXISTS "integration_id" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workspace_limit" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"max_repositories_per_project" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $add_workspace_limit_fk$
BEGIN
	ALTER TABLE "workspace_limit" ADD CONSTRAINT "workspace_limit_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
	WHEN duplicate_object OR duplicate_table THEN NULL;
END
$add_workspace_limit_fk$;--> statement-breakpoint
DO $add_workflow_rule_integration_fk$
BEGIN
	ALTER TABLE "workflow_rule" ADD CONSTRAINT "workflow_rule_integration_id_integration_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integration"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
	WHEN duplicate_object OR duplicate_table THEN NULL;
END
$add_workflow_rule_integration_fk$;--> statement-breakpoint
DO $backfill$
DECLARE
	binding record;
	cfg jsonb;
	key text;
	owner text;
	name text;
	path text;
	repo_id text;
	base_url text;
	scheme text;
	rest text;
	slash integer;
BEGIN
	FOR binding IN
		SELECT id, type, config FROM integration
		WHERE repository_key IS NULL AND type IN ('github', 'gitea', 'gitlab')
	LOOP
		BEGIN
			cfg := binding.config::jsonb;
			key := NULL;

			IF binding.type = 'github' THEN
				repo_id := NULLIF(btrim(coalesce(cfg ->> 'repositoryId', '')), '');
				owner := NULLIF(btrim(coalesce(cfg ->> 'repositoryOwner', '')), '');
				name := NULLIF(btrim(coalesce(cfg ->> 'repositoryName', '')), '');
				IF repo_id IS NOT NULL AND repo_id ~ '^[1-9][0-9]*$' THEN
					key := 'github:' || repo_id;
				ELSIF owner IS NOT NULL AND name IS NOT NULL THEN
					key := 'github:' || lower(owner) || '/' || lower(name);
				ELSE
					RAISE WARNING 'RFC 0001 backfill: github integration % has no repository identity in config; repository_key left NULL', binding.id;
				END IF;
				UPDATE integration SET
					repository_key = key,
					repository_owner = owner,
					repository_name = name,
					repository_id = CASE WHEN repo_id IS NOT NULL AND repo_id ~ '^[1-9][0-9]*$' THEN repo_id::integer END,
					base_url = NULL
				WHERE id = binding.id;

			ELSIF binding.type = 'gitea' THEN
				base_url := NULLIF(btrim(coalesce(cfg ->> 'baseUrl', '')), '');
				IF base_url IS NOT NULL AND position('://' in base_url) > 0 THEN
					scheme := lower(split_part(base_url, '://', 1));
					rest := substring(base_url from position('://' in base_url) + 3);
					slash := position('/' in rest);
					IF slash = 0 THEN
						rest := lower(rest);
					ELSE
						rest := lower(left(rest, slash - 1)) || substring(rest from slash);
					END IF;
					base_url := rtrim(scheme || '://' || rest, '/');
				END IF;
				owner := NULLIF(btrim(coalesce(cfg ->> 'repositoryOwner', '')), '');
				name := NULLIF(btrim(coalesce(cfg ->> 'repositoryName', '')), '');
				IF base_url IS NULL OR owner IS NULL OR name IS NULL THEN
					RAISE WARNING 'RFC 0001 backfill: gitea integration % has incomplete identity (baseUrl/repositoryOwner/repositoryName); repository_key left NULL', binding.id;
				ELSE
					key := 'gitea:' || base_url || '/'
						|| array_to_string(array_remove(string_to_array(lower(owner), '/'), ''), '/')
						|| '/'
						|| array_to_string(array_remove(string_to_array(lower(name), '/'), ''), '/');
					UPDATE integration SET
						repository_key = key,
						repository_owner = owner,
						repository_name = name,
						base_url = base_url
					WHERE id = binding.id;
				END IF;

			ELSIF binding.type = 'gitlab' THEN
				base_url := NULLIF(btrim(coalesce(cfg ->> 'baseUrl', '')), '');
				IF base_url IS NOT NULL AND position('://' in base_url) > 0 THEN
					scheme := lower(split_part(base_url, '://', 1));
					rest := substring(base_url from position('://' in base_url) + 3);
					slash := position('/' in rest);
					IF slash = 0 THEN
						rest := lower(rest);
					ELSE
						rest := lower(left(rest, slash - 1)) || substring(rest from slash);
					END IF;
					base_url := rtrim(scheme || '://' || rest, '/');
				END IF;
				path := NULLIF(array_to_string(array_remove(string_to_array(lower(btrim(coalesce(cfg ->> 'projectPath', ''))), '/'), ''), '/'), '');
				IF base_url IS NULL OR path IS NULL THEN
					RAISE WARNING 'RFC 0001 backfill: gitlab integration % has incomplete identity (baseUrl/projectPath); repository_key left NULL', binding.id;
				ELSE
					key := 'gitlab:' || base_url || '/' || path;
					UPDATE integration SET
						repository_key = key,
						base_url = base_url
					WHERE id = binding.id;
				END IF;
			END IF;
		EXCEPTION WHEN OTHERS THEN
			RAISE WARNING 'RFC 0001 backfill: failed to derive repository identity for integration % (%): %', binding.id, binding.type, SQLERRM;
		END;
	END LOOP;
END
$backfill$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integration_type_repository_key_idx" ON "integration" USING btree ("type","repository_key");--> statement-breakpoint
ALTER TABLE "integration" DROP CONSTRAINT IF EXISTS "integration_project_type_unique";--> statement-breakpoint
DO $add_integration_project_type_repo_unique$
BEGIN
	ALTER TABLE "integration" ADD CONSTRAINT "integration_project_type_repo_unique" UNIQUE ("project_id","type","repository_key");
EXCEPTION
	WHEN duplicate_object OR duplicate_table THEN NULL;
END
$add_integration_project_type_repo_unique$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "integration_project_type_null_repo_unique" ON "integration" USING btree ("project_id","type") WHERE "integration"."repository_key" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_rule_integrationId_idx" ON "workflow_rule" USING btree ("integration_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_rule_resolution_idx" ON "workflow_rule" USING btree ("project_id","integration_type","event_type","integration_id");--> statement-breakpoint
-- RFC 0001 WP0: the legacy github_integration table is intentionally NOT
-- dropped here. plugins/github/migration.ts reads it through raw SQL and
-- drops it at startup, after this migration has run.
--
-- This migration is intentionally idempotent. Databases that already applied
-- its content under its previous number (0064_multi_repo_integrations, before
-- it was renumbered to 0066) can replay it as a no-op, while fresh databases
-- get the same end state. The backfill block only touches rows where
-- repository_key IS NULL, so it is also safe to replay.

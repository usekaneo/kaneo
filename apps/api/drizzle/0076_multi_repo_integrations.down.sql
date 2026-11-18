-- Manual rollback for 0076_multi_repo_integrations.
-- drizzle-kit does not track this file; apply it with psql if a downgrade
-- is required. The guards refuse the downgrade once a project has more than
-- one binding of the same integration type (WP0 step 5), or once any
-- workflow rule is scoped to a single binding: dropping workflow_rule.
-- integration_id would silently turn those repository-specific rules back
-- into type-wide rules that also apply to repositories linked later.
DO $rollback_guard$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM (
			SELECT project_id, type, count(*) AS bindings
			FROM integration
			GROUP BY project_id, type
		) per_project
		WHERE per_project.bindings > 1
	) THEN
		RAISE EXCEPTION 'cannot downgrade 0076_multi_repo_integrations: a project already has multiple repository bindings of one integration type; resolve the duplicates first'
		USING ERRCODE = '55000';
	END IF;
	BEGIN
		IF EXISTS (SELECT 1 FROM workflow_rule WHERE integration_id IS NOT NULL) THEN
			RAISE EXCEPTION 'cannot downgrade 0076_multi_repo_integrations: rewriting workflow rules to repository-specific scope is not automatic; convert the % repository-scoped rules to type-wide rules first', (SELECT count(*) FROM workflow_rule WHERE integration_id IS NOT NULL)
			USING ERRCODE = '55000';
		END IF;
	EXCEPTION WHEN undefined_column THEN
		-- The downgrade is already applied (or partially applied); nothing
		-- repository-specific can be left to protect.
		NULL;
	END;
END
$rollback_guard$;--> statement-breakpoint
DROP INDEX IF EXISTS "workflow_rule_resolution_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "workflow_rule_integrationId_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "integration_project_type_null_repo_unique";--> statement-breakpoint
ALTER TABLE "integration" DROP CONSTRAINT IF EXISTS "integration_project_type_repo_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "integration_type_repository_key_idx";--> statement-breakpoint
ALTER TABLE "integration" ADD CONSTRAINT "integration_project_type_unique" UNIQUE ("project_id","type");--> statement-breakpoint
ALTER TABLE "workflow_rule" DROP CONSTRAINT IF EXISTS "workflow_rule_integration_id_integration_id_fk";--> statement-breakpoint
ALTER TABLE "workflow_rule" DROP COLUMN IF EXISTS "integration_id";--> statement-breakpoint
DROP TABLE IF EXISTS "workspace_limit";--> statement-breakpoint
ALTER TABLE "integration" DROP COLUMN IF EXISTS "base_url";--> statement-breakpoint
ALTER TABLE "integration" DROP COLUMN IF EXISTS "repository_id";--> statement-breakpoint
ALTER TABLE "integration" DROP COLUMN IF EXISTS "repository_name";--> statement-breakpoint
ALTER TABLE "integration" DROP COLUMN IF EXISTS "repository_owner";--> statement-breakpoint
ALTER TABLE "integration" DROP COLUMN IF EXISTS "repository_key"

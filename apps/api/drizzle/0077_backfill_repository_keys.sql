-- RFC 0001 follow-up: repair repository keys that the 0076 backfill missed.
--
-- The original backfill block in 0076 declared a PL/pgSQL variable named
-- base_url and assigned through `SET base_url = base_url`. PostgreSQL raises
-- a column-reference-is-ambiguous error for that statement, and the per-row
-- exception handler recorded it as a warning, so existing Gitea and GitLab
-- rows with a complete configuration kept repository_key NULL. Such rows can
-- be linked again without the unique constraint rejecting the duplicate,
-- double-count quota usage, and stay invisible to linked-state lookups.
--
-- 0076 now assigns through a v_base_url variable; this migration replays the
-- corrected block so databases that already ran the broken backfill converge
-- on the same end state. The block only touches rows where repository_key is
-- still NULL, so it is also a no-op for databases that never hit the error.

DO $backfill$
DECLARE
	binding record;
	cfg jsonb;
	key text;
	owner text;
	name text;
	path text;
	repo_id text;
	v_base_url text;
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
					repository_id = CASE WHEN repo_id IS NOT NULL AND repo_id ~ '^[1-9][0-9]*$' THEN repo_id::bigint END,
					base_url = NULL
				WHERE id = binding.id;

			ELSIF binding.type = 'gitea' THEN
				v_base_url := NULLIF(btrim(coalesce(cfg ->> 'baseUrl', '')), '');
				IF v_base_url IS NOT NULL AND position('://' in v_base_url) > 0 THEN
					scheme := lower(split_part(v_base_url, '://', 1));
					rest := substring(v_base_url from position('://' in v_base_url) + 3);
					slash := position('/' in rest);
					IF slash = 0 THEN
						rest := lower(rest);
					ELSE
						rest := lower(left(rest, slash - 1)) || substring(rest from slash);
					END IF;
					v_base_url := rtrim(scheme || '://' || rest, '/');
				END IF;
				owner := NULLIF(btrim(coalesce(cfg ->> 'repositoryOwner', '')), '');
				name := NULLIF(btrim(coalesce(cfg ->> 'repositoryName', '')), '');
				IF v_base_url IS NULL OR owner IS NULL OR name IS NULL THEN
					RAISE WARNING 'RFC 0001 backfill: gitea integration % has incomplete identity (baseUrl/repositoryOwner/repositoryName); repository_key left NULL', binding.id;
				ELSE
					key := 'gitea:' || v_base_url || '/'
						|| array_to_string(array_remove(string_to_array(lower(owner), '/'), ''), '/')
						|| '/'
						|| array_to_string(array_remove(string_to_array(lower(name), '/'), ''), '/');
					UPDATE integration SET
						repository_key = key,
						repository_owner = owner,
						repository_name = name,
						base_url = v_base_url
					WHERE id = binding.id;
				END IF;

			ELSIF binding.type = 'gitlab' THEN
				v_base_url := NULLIF(btrim(coalesce(cfg ->> 'baseUrl', '')), '');
				IF v_base_url IS NOT NULL AND position('://' in v_base_url) > 0 THEN
					scheme := lower(split_part(v_base_url, '://', 1));
					rest := substring(v_base_url from position('://' in v_base_url) + 3);
					slash := position('/' in rest);
					IF slash = 0 THEN
						rest := lower(rest);
					ELSE
						rest := lower(left(rest, slash - 1)) || substring(rest from slash);
					END IF;
					v_base_url := rtrim(scheme || '://' || rest, '/');
				END IF;
				path := NULLIF(array_to_string(array_remove(string_to_array(lower(btrim(coalesce(cfg ->> 'projectPath', ''))), '/'), ''), '/'), '');
				IF v_base_url IS NULL OR path IS NULL THEN
					RAISE WARNING 'RFC 0001 backfill: gitlab integration % has incomplete identity (baseUrl/projectPath); repository_key left NULL', binding.id;
				ELSE
					key := 'gitlab:' || v_base_url || '/' || path;
					UPDATE integration SET
						repository_key = key,
						base_url = v_base_url
					WHERE id = binding.id;
				END IF;
			END IF;
		EXCEPTION WHEN OTHERS THEN
			RAISE WARNING 'RFC 0001 backfill: failed to derive repository identity for integration % (%): %', binding.id, binding.type, SQLERRM;
		END;
	END LOOP;
END
$backfill$;

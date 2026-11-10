CREATE OR REPLACE FUNCTION quills.project_team_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE previous text:=current_setting('quills.workspace_id',true); t text;
BEGIN
 IF TG_TABLE_NAME='team' THEN
  IF TG_OP='DELETE' OR OLD.workspace_id IS DISTINCT FROM NEW.workspace_id THEN
   PERFORM set_config('quills.workspace_id',OLD.workspace_id,true);
   UPDATE quills.teams SET kaneo_team_id=NULL,deleted_at=now(),is_default=false WHERE kaneo_team_id=OLD.id;
   PERFORM set_config('quills.workspace_id',coalesce(previous,''),true);
  ELSE PERFORM quills.sync_shared_team(NEW.id); END IF;
 ELSIF TG_TABLE_NAME='team_member' THEN
  IF TG_OP<>'INSERT' THEN PERFORM quills.sync_shared_team(OLD.team_id); END IF;
  IF TG_OP<>'DELETE' THEN PERFORM quills.sync_shared_team(NEW.team_id); END IF;
 ELSE
  FOR t IN SELECT tm.team_id FROM public.team_member tm JOIN public.team pt ON pt.id=tm.team_id WHERE (TG_OP<>'INSERT' AND tm.user_id=OLD.user_id) OR (TG_OP<>'DELETE' AND tm.user_id=NEW.user_id) LOOP
   PERFORM quills.sync_shared_team(t);
  END LOOP;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;

--> statement-breakpoint
CREATE FUNCTION quills.prepare_import_partitions(days date[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog SET lock_timeout='10s' AS $$
DECLARE d date; today date:=(now() AT TIME ZONE 'UTC')::date;
BEGIN
 IF nullif(current_setting('quills.workspace_id',true),'') IS NULL THEN RAISE EXCEPTION 'Workspace scope required'; END IF;
 IF cardinality(days)>98 OR EXISTS(SELECT 1 FROM unnest(days) v WHERE v<today-90 OR v>today+7 OR v IS NULL) THEN RAISE EXCEPTION 'Page views outside the retained import window'; END IF;
 IF NOT pg_try_advisory_xact_lock(48203,hashtext(current_database())) THEN RAISE EXCEPTION 'Partition maintenance is busy; retry import'; END IF;
 FOR d IN SELECT DISTINCT v FROM unnest(days) v ORDER BY v LOOP
  EXECUTE format('CREATE TABLE IF NOT EXISTS quills.%I PARTITION OF quills.page_views FOR VALUES FROM (%L) TO (%L)', 'page_views_'||to_char(d,'YYYYMMDD'), d::text||' 00:00:00+00', (d+1)::text||' 00:00:00+00');
 END LOOP;
END $$;

--> statement-breakpoint
CREATE FUNCTION quills.advance_imported_sequences() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog SET lock_timeout='10s' AS $$
DECLARE target record; seq text; imported bigint; allocated bigint; called boolean; ws text:=nullif(current_setting('quills.workspace_id',true),'');
BEGIN
 IF ws IS NULL THEN RAISE EXCEPTION 'Workspace scope required'; END IF;
 FOR target IN SELECT * FROM (VALUES ('kb_categories','url_id'),('kb_articles','url_id'),('tickets','number')) AS v(table_name,column_name) LOOP
  seq:=pg_get_serial_sequence('quills.'||target.table_name,target.column_name);
  -- ALTER locks against nextval; transactional RESTART preserves dry-run rollback.
  EXECUTE format('ALTER SEQUENCE %s INCREMENT BY 1',seq);
  EXECUTE format('SELECT last_value,is_called FROM %s',seq) INTO allocated,called;
  EXECUTE format('SELECT max(%I) FROM quills.%I WHERE workspace_id=$1',target.column_name,target.table_name) INTO imported USING ws;
  IF imported IS NOT NULL AND imported>=allocated THEN
   EXECUTE format('ALTER SEQUENCE %s RESTART WITH %s',seq,greatest(imported+1,allocated+CASE WHEN called THEN 1 ELSE 0 END));
  END IF;
 END LOOP;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION quills.prepare_import_partitions(date[]),quills.advance_imported_sequences() FROM PUBLIC;
--> statement-breakpoint
SELECT quills_migrations.capture_schema_manifest();

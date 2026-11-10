CREATE OR REPLACE FUNCTION quills.sync_shared_team(team_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ws text; team_name text; qteam uuid; previous text:=current_setting('quills.workspace_id',true);
BEGIN
 SELECT workspace_id,name INTO ws,team_name FROM public.team WHERE id=team_id FOR SHARE;
 IF ws IS NULL THEN RETURN; END IF;
 PERFORM set_config('quills.workspace_id',ws,true);
 SELECT id INTO qteam FROM quills.teams WHERE workspace_id=ws AND kaneo_team_id=team_id AND deleted_at IS NULL FOR UPDATE;
 IF qteam IS NOT NULL THEN
  UPDATE quills.teams SET name=team_name WHERE workspace_id=ws AND id=qteam;
  DELETE FROM quills.team_members m WHERE m.workspace_id=ws AND m.team_id=qteam AND NOT EXISTS (
   SELECT 1 FROM quills.principal p JOIN public.team_member tm ON tm.user_id=p.kaneo_user_id JOIN public.workspace_member wm ON wm.user_id=p.kaneo_user_id AND wm.workspace_id=ws WHERE p.workspace_id=ws AND p.id=m.principal_id AND tm.team_id=sync_shared_team.team_id
  );
  INSERT INTO quills.team_members(workspace_id,id,team_id,principal_id,created_at)
   SELECT ws,gen_random_uuid(),qteam,p.id,now() FROM public.team_member tm JOIN public.workspace_member wm ON wm.user_id=tm.user_id AND wm.workspace_id=ws JOIN quills.principal p ON p.workspace_id=ws AND p.kaneo_user_id=tm.user_id WHERE tm.team_id=sync_shared_team.team_id
   ON CONFLICT DO NOTHING;
 END IF;
 PERFORM set_config('quills.workspace_id',coalesce(previous,''),true);
END $$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION quills.protect_shared_roster() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF current_user='quills_runtime' AND EXISTS (
  SELECT 1 FROM quills.teams t WHERE t.kaneo_team_id IS NOT NULL AND
  ((TG_OP<>'INSERT' AND t.workspace_id=OLD.workspace_id AND t.id=OLD.team_id) OR (TG_OP<>'DELETE' AND t.workspace_id=NEW.workspace_id AND t.id=NEW.team_id))
 ) THEN RAISE EXCEPTION 'Manage shared team membership through Kaneo'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;

--> statement-breakpoint
CREATE OR REPLACE FUNCTION quills.runnable_workspaces(after_workspace text) RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT DISTINCT q.workspace_id FROM (
  SELECT workspace_id FROM quills.job_queue WHERE queue='quills.event' AND ((status='pending' AND run_at<=now()) OR (status='running' AND locked_until<=now()))
  UNION ALL SELECT workspace_id FROM quills.events e WHERE published_at IS NULL AND NOT EXISTS (SELECT 1 FROM quills.job_queue j WHERE j.workspace_id=e.workspace_id AND j.queue='quills.event' AND j.dedupe_key=e.event_id)
 ) q JOIN public.workspace w ON w.id=q.workspace_id
 WHERE w.archived_at IS NULL AND q.workspace_id>after_workspace ORDER BY q.workspace_id LIMIT 100;
$$;

--> statement-breakpoint
SELECT quills_migrations.capture_schema_manifest();

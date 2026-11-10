-- Acquire shared-platform write locks before touching feature relations.
LOCK TABLE public.workspace,public."user",public.workspace_member,public.project,public.task,public.team,public.team_member IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
DO $$ DECLARE ws text; previous text:=current_setting('quills.workspace_id',true); BEGIN
FOR ws IN SELECT id FROM public.workspace LOOP
 PERFORM set_config('quills.workspace_id',ws,true);
 WITH ranked AS (SELECT id,row_number() OVER (ORDER BY created_at,id) n FROM quills.teams WHERE is_default AND deleted_at IS NULL)
 UPDATE quills.teams t SET is_default=false FROM ranked r WHERE t.id=r.id AND r.n>1;
END LOOP;
PERFORM set_config('quills.workspace_id',coalesce(previous,''),true);
END $$;
--> statement-breakpoint
CREATE TABLE "quills"."board_projects" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"board_id" uuid NOT NULL,
	"project_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "board_projects_workspace_id_board_id_project_id_pk" PRIMARY KEY("workspace_id","board_id","project_id")
);
--> statement-breakpoint
ALTER TABLE "quills"."board_projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quills"."post_tasks" (
	"workspace_id" text DEFAULT nullif(current_setting('quills.workspace_id', true), '') NOT NULL,
	"post_id" uuid NOT NULL,
	"task_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_tasks_workspace_id_post_id_task_id_pk" PRIMARY KEY("workspace_id","post_id","task_id")
);
--> statement-breakpoint
ALTER TABLE "quills"."post_tasks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quills"."settings" ADD COLUMN "catalogue_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "quills"."teams" ADD COLUMN "kaneo_team_id" text;--> statement-breakpoint
ALTER TABLE "quills"."audit_log" ADD COLUMN "actor_principal_id" uuid;--> statement-breakpoint
ALTER TABLE "quills"."board_projects" ADD CONSTRAINT "board_projects_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."board_projects" ADD CONSTRAINT "board_projects_workspace_id_board_id_boards_workspace_id_id_fk" FOREIGN KEY ("workspace_id","board_id") REFERENCES "quills"."boards"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."board_projects" ADD CONSTRAINT "board_projects_workspace_id_project_id_project_workspace_id_id_fk" FOREIGN KEY ("workspace_id","project_id") REFERENCES "public"."project"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_tasks" ADD CONSTRAINT "post_tasks_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_tasks" ADD CONSTRAINT "post_tasks_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."post_tasks" ADD CONSTRAINT "post_tasks_workspace_id_post_id_posts_workspace_id_id_fk" FOREIGN KEY ("workspace_id","post_id") REFERENCES "quills"."posts"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_projects_project_idx" ON "quills"."board_projects" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "post_tasks_task_idx" ON "quills"."post_tasks" USING btree ("task_id");--> statement-breakpoint
ALTER TABLE "quills"."teams" ADD CONSTRAINT "teams_kaneo_team_id_team_id_fk" FOREIGN KEY ("kaneo_team_id") REFERENCES "public"."team"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quills"."audit_log" ADD CONSTRAINT "audit_log_workspace_id_actor_principal_id_principal_workspace_id_id_fk" FOREIGN KEY ("workspace_id","actor_principal_id") REFERENCES "quills"."principal"("workspace_id","id") ON DELETE SET NULL ("actor_principal_id") ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "teams_kaneo_team_idx" ON "quills"."teams" USING btree ("workspace_id","kaneo_team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_one_default_idx" ON "quills"."teams" USING btree ("workspace_id") WHERE "quills"."teams"."is_default" AND "quills"."teams"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "audit_log_workspace_actor_idx" ON "quills"."audit_log" USING btree ("workspace_id","actor_principal_id","occurred_at");--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."board_projects" AS PERMISSIVE FOR ALL TO public USING ("quills"."board_projects"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."board_projects"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));--> statement-breakpoint
CREATE POLICY "workspace_isolation" ON "quills"."post_tasks" AS PERMISSIVE FOR ALL TO public USING ("quills"."post_tasks"."workspace_id" = nullif(current_setting('quills.workspace_id', true), '')) WITH CHECK ("quills"."post_tasks"."workspace_id" = nullif(current_setting('quills.workspace_id', true), ''));
--> statement-breakpoint
ALTER TABLE "quills"."board_projects" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "quills"."post_tasks" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE FUNCTION quills.storage_keys_for_workspace(ws text) RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT DISTINCT key FROM (
 SELECT quills.storage_keys('customer_identity',jsonb_build_object('image_key',image_key)) key FROM quills.customer_identity WHERE workspace_id=ws
 UNION ALL SELECT quills.storage_keys('settings',jsonb_build_object('logo_key',logo_key,'favicon_key',favicon_key,'header_logo_key',header_logo_key,'portal_og_image_key',portal_og_image_key)) FROM quills.settings WHERE workspace_id=ws
 UNION ALL SELECT avatar_key FROM quills.principal WHERE workspace_id=ws
 UNION ALL SELECT quills.storage_keys('files',jsonb_build_object('storage_key',storage_key,'meta',meta)) FROM quills.files WHERE workspace_id=ws
 UNION ALL SELECT storage_key FROM quills.assistant_documents WHERE workspace_id=ws
 UNION ALL SELECT s3_key FROM quills.export_runs WHERE workspace_id=ws
 UNION ALL SELECT quills.storage_keys('conversation_messages',jsonb_build_object('attachments',attachments)) FROM quills.conversation_messages WHERE workspace_id=ws
 ) refs WHERE key IS NOT NULL AND key<>'';
$$;
--> statement-breakpoint
CREATE FUNCTION quills.storage_object_is_referenced(key text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS (
 SELECT 1 FROM quills.customer_identity WHERE image_key=key
 UNION ALL SELECT 1 FROM quills.settings WHERE logo_key=key OR favicon_key=key OR header_logo_key=key OR portal_og_image_key=key
 UNION ALL SELECT 1 FROM quills.principal WHERE avatar_key=key
 UNION ALL SELECT 1 FROM quills.files WHERE storage_key=key OR meta->>'thumbKey'=key OR meta->>'renditionKey'=key
 UNION ALL SELECT 1 FROM quills.assistant_documents WHERE storage_key=key
 UNION ALL SELECT 1 FROM quills.export_runs WHERE s3_key=key
 UNION ALL SELECT 1 FROM quills.conversation_messages WHERE attachments @> jsonb_build_array(jsonb_build_object('preview',jsonb_build_object('thumbKey',key))) OR attachments @> jsonb_build_array(jsonb_build_object('preview',jsonb_build_object('renditionKey',key)))
 );
$$;
--> statement-breakpoint
CREATE FUNCTION quills.check_post_task_link() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ws text; BEGIN
 SELECT p.workspace_id INTO ws FROM public.task t JOIN public.project p ON p.id=t.project_id WHERE t.id=NEW.task_id FOR SHARE OF t,p;
 IF ws IS DISTINCT FROM NEW.workspace_id THEN RAISE EXCEPTION 'Task must belong to the same workspace'; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER quills_task_link_guard BEFORE INSERT OR UPDATE ON quills.post_tasks FOR EACH ROW EXECUTE FUNCTION quills.check_post_task_link();
--> statement-breakpoint
CREATE FUNCTION quills.detach_moved_links() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE previous text:=current_setting('quills.workspace_id',true); old_ws text; new_ws text;
BEGIN
 IF TG_TABLE_NAME='project' THEN
  IF OLD.workspace_id=NEW.workspace_id THEN RETURN NEW; END IF;
  PERFORM set_config('quills.workspace_id',OLD.workspace_id,true);
  DELETE FROM quills.board_projects WHERE project_id=OLD.id;
  DELETE FROM quills.post_tasks WHERE task_id IN (SELECT id FROM public.task WHERE project_id=OLD.id);
 ELSE
  SELECT workspace_id INTO old_ws FROM public.project WHERE id=OLD.project_id;
  SELECT workspace_id INTO new_ws FROM public.project WHERE id=NEW.project_id;
  IF old_ws IS DISTINCT FROM new_ws THEN
   PERFORM set_config('quills.workspace_id',old_ws,true);
   DELETE FROM quills.post_tasks WHERE task_id=OLD.id;
  END IF;
 END IF;
 PERFORM set_config('quills.workspace_id',coalesce(previous,''),true);
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER quills_detach_project_links BEFORE UPDATE OF workspace_id ON public.project FOR EACH ROW EXECUTE FUNCTION quills.detach_moved_links();
--> statement-breakpoint
CREATE TRIGGER quills_detach_task_links BEFORE UPDATE OF project_id ON public.task FOR EACH ROW EXECUTE FUNCTION quills.detach_moved_links();
--> statement-breakpoint
CREATE FUNCTION quills.canonical_team() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ws text; team_name text;
BEGIN
 IF NEW.kaneo_team_id IS NOT NULL THEN
  SELECT workspace_id,name INTO ws,team_name FROM public.team WHERE id=NEW.kaneo_team_id FOR SHARE;
  IF ws IS DISTINCT FROM NEW.workspace_id THEN RAISE EXCEPTION 'Team must belong to the same workspace'; END IF;
  NEW.name:=team_name;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER quills_canonical_team BEFORE INSERT OR UPDATE OF kaneo_team_id,workspace_id,name ON quills.teams FOR EACH ROW EXECUTE FUNCTION quills.canonical_team();
--> statement-breakpoint
CREATE FUNCTION quills.sync_shared_team(team_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ws text; team_name text; qteam uuid; previous text:=current_setting('quills.workspace_id',true);
BEGIN
 SELECT workspace_id,name INTO ws,team_name FROM public.team WHERE id=team_id FOR SHARE;
 IF ws IS NULL THEN RETURN; END IF;
 PERFORM set_config('quills.workspace_id',ws,true);
 SELECT id INTO qteam FROM quills.teams WHERE kaneo_team_id=team_id AND deleted_at IS NULL FOR UPDATE;
 IF qteam IS NOT NULL THEN
  UPDATE quills.teams SET name=team_name WHERE id=qteam;
  DELETE FROM quills.team_members m WHERE m.team_id=qteam AND NOT EXISTS (
   SELECT 1 FROM quills.principal p JOIN public.team_member tm ON tm.user_id=p.kaneo_user_id JOIN public.workspace_member wm ON wm.user_id=p.kaneo_user_id AND wm.workspace_id=ws WHERE p.id=m.principal_id AND tm.team_id=sync_shared_team.team_id
  );
  INSERT INTO quills.team_members(workspace_id,id,team_id,principal_id,created_at)
   SELECT ws,gen_random_uuid(),qteam,p.id,now() FROM public.team_member tm JOIN public.workspace_member wm ON wm.user_id=tm.user_id AND wm.workspace_id=ws JOIN quills.principal p ON p.kaneo_user_id=tm.user_id WHERE tm.team_id=sync_shared_team.team_id
   ON CONFLICT DO NOTHING;
 END IF;
 PERFORM set_config('quills.workspace_id',coalesce(previous,''),true);
END $$;
--> statement-breakpoint
CREATE FUNCTION quills.sync_team_binding() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='UPDATE' AND (OLD.kaneo_team_id IS DISTINCT FROM NEW.kaneo_team_id OR NEW.deleted_at IS NOT NULL) THEN
  DELETE FROM quills.team_members WHERE workspace_id=NEW.workspace_id AND team_id=NEW.id;
 END IF;
 IF NEW.kaneo_team_id IS NOT NULL THEN PERFORM quills.sync_shared_team(NEW.kaneo_team_id); END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER quills_team_binding AFTER INSERT OR UPDATE OF kaneo_team_id,deleted_at ON quills.teams FOR EACH ROW EXECUTE FUNCTION quills.sync_team_binding();
--> statement-breakpoint
CREATE FUNCTION quills.project_team_change() RETURNS trigger
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
  FOR t IN SELECT tm.team_id FROM public.team_member tm JOIN public.team pt ON pt.id=tm.team_id WHERE tm.user_id=CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END LOOP
   PERFORM quills.sync_shared_team(t);
  END LOOP;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER quills_shared_team_change AFTER UPDATE OF name ON public.team FOR EACH ROW EXECUTE FUNCTION quills.project_team_change();
--> statement-breakpoint
CREATE TRIGGER quills_shared_team_detach BEFORE DELETE OR UPDATE OF workspace_id ON public.team FOR EACH ROW EXECUTE FUNCTION quills.project_team_change();
--> statement-breakpoint
CREATE TRIGGER quills_shared_team_roster AFTER INSERT OR UPDATE OR DELETE ON public.team_member FOR EACH ROW EXECUTE FUNCTION quills.project_team_change();
--> statement-breakpoint
CREATE TRIGGER quills_shared_team_membership AFTER INSERT OR UPDATE OR DELETE ON public.workspace_member FOR EACH ROW EXECUTE FUNCTION quills.project_team_change();
--> statement-breakpoint
CREATE FUNCTION quills.protect_shared_roster() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE team_id uuid:=CASE WHEN TG_OP='DELETE' THEN OLD.team_id ELSE NEW.team_id END;
BEGIN
 IF current_user='quills_runtime' AND EXISTS (SELECT 1 FROM quills.teams WHERE id=team_id AND kaneo_team_id IS NOT NULL) THEN RAISE EXCEPTION 'Manage shared team membership through Kaneo'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER quills_shared_roster_guard BEFORE INSERT OR UPDATE OR DELETE ON quills.team_members FOR EACH ROW EXECUTE FUNCTION quills.protect_shared_roster();
--> statement-breakpoint
DO $$ DECLARE ws text; previous text:=current_setting('quills.workspace_id',true); BEGIN
 FOR ws IN SELECT id FROM public.workspace LOOP
  PERFORM set_config('quills.workspace_id',ws,true);
  UPDATE quills.audit_log a SET actor_principal_id=p.id FROM quills.principal p WHERE a.actor_user_id=p.user_id AND a.actor_principal_id IS NULL;
 END LOOP;
 PERFORM set_config('quills.workspace_id',coalesce(previous,''),true);
END $$;
--> statement-breakpoint
-- Transactions importing a complete workspace may defer its foreign keys until commit.
DO $$ DECLARE fk record; BEGIN
 FOR fk IN SELECT c.conname,t.relname FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='quills' AND c.contype='f' AND c.conparentid=0 LOOP
  EXECUTE format('ALTER TABLE quills.%I ALTER CONSTRAINT %I DEFERRABLE INITIALLY IMMEDIATE',fk.relname,fk.conname);
 END LOOP;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION quills.storage_keys_for_workspace(text),quills.storage_object_is_referenced(text),quills.check_post_task_link(),quills.detach_moved_links(),quills.canonical_team(),quills.sync_shared_team(text),quills.sync_team_binding(),quills.project_team_change(),quills.protect_shared_roster() FROM PUBLIC;

--> statement-breakpoint
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['job_queue','events'] LOOP
  EXECUTE format('CREATE POLICY platform_queue_read ON quills.%I FOR SELECT TO %I USING (true)',t,current_user);
 END LOOP;
END $$;
--> statement-breakpoint
CREATE FUNCTION quills.runnable_workspaces(after_workspace text) RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT DISTINCT q.workspace_id FROM (
  SELECT workspace_id FROM quills.job_queue WHERE queue IN ('quills.event','quills.export') AND ((status='pending' AND run_at<=now()) OR (status='running' AND locked_until<=now()))
  UNION ALL SELECT workspace_id FROM quills.events WHERE published_at IS NULL
 ) q JOIN public.workspace w ON w.id=q.workspace_id
 WHERE w.archived_at IS NULL AND q.workspace_id>after_workspace ORDER BY q.workspace_id LIMIT 100;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION quills.runnable_workspaces(text) FROM PUBLIC;

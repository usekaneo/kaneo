ALTER TABLE "quills"."principal" ADD CONSTRAINT "principal_identity_check" CHECK (num_nonnulls("quills"."principal"."user_id", "quills"."principal"."kaneo_user_id") <= 1);
--> statement-breakpoint
-- The migration owner can inspect storage references; tenant role remains scoped.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['customer_identity','settings','principal','files','assistant_documents','export_runs','conversation_messages'] LOOP
    EXECUTE format('CREATE POLICY platform_storage_read ON quills.%I FOR SELECT TO %I USING (true)', t, current_user);
  END LOOP;
END $$;
--> statement-breakpoint
CREATE FUNCTION quills.storage_keys(table_name text, record jsonb) RETURNS SETOF text
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT DISTINCT key FROM (
    SELECT record ->> field AS key FROM unnest(CASE table_name
      WHEN 'customer_identity' THEN ARRAY['image_key']
      WHEN 'settings' THEN ARRAY['logo_key','favicon_key','header_logo_key','portal_og_image_key']
      WHEN 'principal' THEN ARRAY['avatar_key']
      WHEN 'files' THEN ARRAY['storage_key']
      WHEN 'assistant_documents' THEN ARRAY['storage_key']
      WHEN 'export_runs' THEN ARRAY['s3_key'] ELSE ARRAY[]::text[] END) field
    UNION ALL SELECT record->'meta'->>field FROM unnest(ARRAY['thumbKey','renditionKey']) field WHERE table_name='files'
    UNION ALL SELECT attachment->'preview'->>field
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(record->'attachments')='array' THEN record->'attachments' ELSE '[]'::jsonb END) attachment,
      unnest(ARRAY['thumbKey','renditionKey']) field WHERE table_name='conversation_messages'
  ) keys WHERE key IS NOT NULL AND key <> '';
$$;
--> statement-breakpoint
CREATE FUNCTION quills.storage_references() RETURNS TABLE(workspace_id text, object_key text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT t.workspace_id, quills.storage_keys('customer_identity',jsonb_build_object('image_key',t.image_key)) FROM quills.customer_identity t
  UNION ALL SELECT t.workspace_id, quills.storage_keys('settings',jsonb_build_object('logo_key',t.logo_key,'favicon_key',t.favicon_key,'header_logo_key',t.header_logo_key,'portal_og_image_key',t.portal_og_image_key)) FROM quills.settings t
  UNION ALL SELECT t.workspace_id, quills.storage_keys('principal',jsonb_build_object('avatar_key',t.avatar_key)) FROM quills.principal t
  UNION ALL SELECT t.workspace_id, quills.storage_keys('files',jsonb_build_object('storage_key',t.storage_key,'meta',t.meta)) FROM quills.files t
  UNION ALL SELECT t.workspace_id, quills.storage_keys('assistant_documents',jsonb_build_object('storage_key',t.storage_key)) FROM quills.assistant_documents t
  UNION ALL SELECT t.workspace_id, quills.storage_keys('export_runs',jsonb_build_object('s3_key',t.s3_key)) FROM quills.export_runs t
  UNION ALL SELECT t.workspace_id, quills.storage_keys('conversation_messages',jsonb_build_object('attachments',t.attachments)) FROM quills.conversation_messages t;
$$;
--> statement-breakpoint
CREATE FUNCTION quills.track_storage_changes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE old_record jsonb := CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  new_record jsonb := CASE WHEN TG_OP='DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
  key text;
BEGIN
  FOR key IN SELECT k FROM (SELECT quills.storage_keys(TG_TABLE_NAME,old_record) k UNION SELECT quills.storage_keys(TG_TABLE_NAME,new_record)) keys ORDER BY k LOOP
    PERFORM pg_advisory_xact_lock(hashtext('storage-object'),hashtext(key));
  END LOOP;
  INSERT INTO public.storage_cleanup(object_key)
    SELECT quills.storage_keys(TG_TABLE_NAME,old_record)
    EXCEPT SELECT quills.storage_keys(TG_TABLE_NAME,new_record)
    ON CONFLICT DO NOTHING;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['customer_identity','settings','principal','files','assistant_documents','export_runs','conversation_messages'] LOOP
    EXECUTE format('CREATE TRIGGER quills_storage_changes BEFORE INSERT OR UPDATE OR DELETE ON quills.%I FOR EACH ROW EXECUTE FUNCTION quills.track_storage_changes()',t);
  END LOOP;
END $$;
--> statement-breakpoint
CREATE FUNCTION quills.check_kaneo_actor() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF NEW.kaneo_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."user" u WHERE u.id=NEW.kaneo_user_id AND (
      'admin'=ANY(string_to_array(u.role,',')) OR EXISTS (
        SELECT 1 FROM public.workspace_member m WHERE m.workspace_id=NEW.workspace_id AND m.user_id=u.id
      )
    )
  ) THEN RAISE EXCEPTION 'Quills actor must belong to the workspace' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER quills_kaneo_actor BEFORE INSERT OR UPDATE OF workspace_id,kaneo_user_id ON quills.principal FOR EACH ROW EXECUTE FUNCTION quills.check_kaneo_actor();
--> statement-breakpoint
CREATE FUNCTION quills.sync_kaneo_member(ws text, account text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE previous text := current_setting('quills.workspace_id',true);
BEGIN
  PERFORM set_config('quills.workspace_id',ws,true);
  -- Preserve the actor ID when upgrading an existing linked customer profile.
  UPDATE quills.principal p SET kaneo_user_id=account,user_id=NULL,role='user'
    FROM quills.customer_identity c
    WHERE p.workspace_id=ws AND c.workspace_id=ws AND p.user_id=c.id AND c.kaneo_user_id=account
    AND EXISTS (SELECT 1 FROM public.workspace_member WHERE workspace_id=ws AND user_id=account)
    AND NOT EXISTS (SELECT 1 FROM quills.principal WHERE workspace_id=ws AND kaneo_user_id=account);
  INSERT INTO quills.principal(workspace_id,id,kaneo_user_id,type,role,display_name,avatar_url,created_at)
    SELECT ws,gen_random_uuid(),u.id,'user','user',u.name,u.image,now() FROM public."user" u
    WHERE u.id=account AND EXISTS (SELECT 1 FROM public.workspace_member WHERE workspace_id=ws AND user_id=account)
    ON CONFLICT (workspace_id,kaneo_user_id) DO UPDATE SET display_name=EXCLUDED.display_name,avatar_url=EXCLUDED.avatar_url,role='user';
  PERFORM set_config('quills.workspace_id',coalesce(previous,''),true);
END $$;
--> statement-breakpoint
CREATE FUNCTION quills.sync_kaneo_membership() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE previous text := current_setting('quills.workspace_id',true);
BEGIN
  IF TG_OP='DELETE' OR (TG_OP='UPDATE' AND (OLD.workspace_id,OLD.user_id) IS DISTINCT FROM (NEW.workspace_id,NEW.user_id)) THEN
    PERFORM set_config('quills.workspace_id',OLD.workspace_id,true);
    DELETE FROM quills.principal_role_assignments WHERE workspace_id=OLD.workspace_id AND principal_id IN (
      SELECT id FROM quills.principal WHERE workspace_id=OLD.workspace_id AND kaneo_user_id=OLD.user_id
    );
    PERFORM set_config('quills.workspace_id',coalesce(previous,''),true);
  END IF;
  IF TG_OP <> 'DELETE' THEN PERFORM quills.sync_kaneo_member(NEW.workspace_id,NEW.user_id); RETURN NEW; END IF;
  RETURN OLD;
END $$;
--> statement-breakpoint
CREATE TRIGGER quills_member_projection AFTER INSERT OR UPDATE OR DELETE ON public.workspace_member FOR EACH ROW EXECUTE FUNCTION quills.sync_kaneo_membership();
--> statement-breakpoint
CREATE FUNCTION quills.sync_kaneo_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE previous text := current_setting('quills.workspace_id',true); ws text;
BEGIN
  FOR ws IN SELECT DISTINCT workspace_id FROM quills.principal WHERE kaneo_user_id=OLD.id LOOP
    PERFORM set_config('quills.workspace_id',ws,true);
    IF TG_OP='DELETE' THEN
      UPDATE quills.principal SET kaneo_user_id=NULL,display_name='Deleted user',avatar_url=NULL,avatar_key=NULL,contact_email=NULL,role='user'
        WHERE workspace_id=ws AND kaneo_user_id=OLD.id;
    ELSE
      UPDATE quills.principal SET display_name=NEW.name,avatar_url=NEW.image,avatar_key=NULL
        WHERE workspace_id=ws AND kaneo_user_id=NEW.id;
    END IF;
  END LOOP;
  PERFORM set_config('quills.workspace_id',coalesce(previous,''),true);
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER quills_profile_projection AFTER UPDATE OF name,image ON public."user" FOR EACH ROW EXECUTE FUNCTION quills.sync_kaneo_profile();
--> statement-breakpoint
CREATE TRIGGER quills_profile_retention BEFORE DELETE ON public."user" FOR EACH ROW EXECUTE FUNCTION quills.sync_kaneo_profile();
--> statement-breakpoint
CREATE FUNCTION quills.canonical_workspace_settings() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  SELECT name,slug INTO STRICT NEW.name,NEW.slug FROM public.workspace WHERE id=NEW.workspace_id;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER quills_canonical_settings BEFORE INSERT OR UPDATE OF workspace_id,name,slug ON quills.settings FOR EACH ROW EXECUTE FUNCTION quills.canonical_workspace_settings();
--> statement-breakpoint
CREATE FUNCTION quills.sync_kaneo_workspace() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE previous text := current_setting('quills.workspace_id',true);
BEGIN
  PERFORM set_config('quills.workspace_id',NEW.id,true);
  UPDATE quills.settings SET name=NEW.name,slug=NEW.slug WHERE workspace_id=NEW.id;
  PERFORM set_config('quills.workspace_id',coalesce(previous,''),true);
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER quills_workspace_projection AFTER UPDATE OF name,slug ON public.workspace FOR EACH ROW EXECUTE FUNCTION quills.sync_kaneo_workspace();
--> statement-breakpoint
REVOKE ALL ON FUNCTION quills.storage_keys(text,jsonb),quills.storage_references(),quills.track_storage_changes(),quills.check_kaneo_actor(),quills.sync_kaneo_member(text,text),quills.sync_kaneo_membership(),quills.sync_kaneo_profile(),quills.canonical_workspace_settings(),quills.sync_kaneo_workspace() FROM PUBLIC;
--> statement-breakpoint
DO $$ DECLARE m record; BEGIN
  FOR m IN SELECT workspace_id,user_id FROM public.workspace_member LOOP
    PERFORM quills.sync_kaneo_member(m.workspace_id,m.user_id);
  END LOOP;
END $$;

--> statement-breakpoint
DO $$ DECLARE r record; value jsonb; BEGIN
FOR r IN SELECT id,role,permission FROM public.workspace_role WHERE role IN ('viewer','member','admin') LOOP
BEGIN value := r.permission::jsonb; EXCEPTION WHEN invalid_text_representation THEN CONTINUE; END;
IF r.role='viewer' AND value='{"organization": [], "member": [], "invitation": [], "team": [], "ac": ["read"], "project": ["read"], "task": ["read"], "label": ["read"], "workspace": ["read"]}'::jsonb THEN UPDATE public.workspace_role SET permission=(value || '{"quills": ["read"]}'::jsonb)::text,updated_at=now() WHERE id=r.id; END IF;
IF r.role='member' AND value='{"organization": [], "member": [], "invitation": [], "team": [], "ac": ["read"], "project": ["create", "read"], "task": ["create", "read", "update"], "label": ["create", "read", "update", "delete"], "workspace": ["read"]}'::jsonb THEN UPDATE public.workspace_role SET permission=(value || '{"quills": ["read", "create", "update"]}'::jsonb)::text,updated_at=now() WHERE id=r.id; END IF;
IF r.role='admin' AND value='{"organization": ["update"], "invitation": ["create", "cancel"], "member": ["create", "update", "delete"], "team": ["create", "update", "delete"], "ac": ["create", "read", "update", "delete"], "project": ["create", "read", "update", "delete", "share"], "task": ["create", "read", "update", "delete", "assign"], "label": ["create", "read", "update", "delete"], "workspace": ["read", "update", "manage_settings"]}'::jsonb THEN UPDATE public.workspace_role SET permission=(value || '{"quills": ["read", "create", "update", "delete", "manage_settings"]}'::jsonb)::text,updated_at=now() WHERE id=r.id; END IF;
END LOOP; END $$;

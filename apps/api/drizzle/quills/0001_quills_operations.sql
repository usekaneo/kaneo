CREATE OR REPLACE FUNCTION quills.purge_integration_sync_source() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE should_purge boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN should_purge := true;
  ELSE
    should_purge := NEW.deleted_at IS NOT NULL;
    IF TG_ARGV[0] = 'post' OR TG_ARGV[0] = 'comment' THEN should_purge := should_purge OR NEW.moderation_state <> 'published'; END IF;
    IF TG_ARGV[0] = 'comment' THEN should_purge := should_purge OR NEW.is_private; END IF;
    IF TG_ARGV[0] = 'message' THEN should_purge := should_purge OR NEW.is_internal; END IF;
    IF TG_ARGV[0] = 'changelog' THEN should_purge := should_purge OR NEW.published_at IS NULL OR NEW.published_at > now(); END IF;
  END IF;
  IF should_purge THEN
    UPDATE quills.integration_sync_operations SET
      payload = CASE WHEN kind = 'archive' AND TG_OP <> 'DELETE' THEN payload ELSE NULL END,
      error_code = CASE WHEN kind <> 'archive' AND NOT cancel_requested AND dispatched_at IS NULL
        AND state IN ('queued', 'running', 'retry_wait', 'failed', 'auth_required', 'conflict') THEN 'source_unavailable' ELSE error_code END,
      result = NULL, cancel_requested = CASE WHEN kind = 'archive' THEN cancel_requested ELSE true END,
      state = CASE WHEN state = 'running' OR dispatched_at IS NOT NULL THEN state
        WHEN state IN ('queued', 'retry_wait', 'failed', 'auth_required', 'conflict') AND kind <> 'archive' THEN 'cancelled' ELSE state END,
      finished_at = CASE WHEN state NOT IN ('running') AND dispatched_at IS NULL AND kind <> 'archive' THEN COALESCE(finished_at, now()) ELSE finished_at END,
      updated_at = now(), version = version + 1
    WHERE workspace_id = OLD.workspace_id AND ((source_type = TG_ARGV[0] AND source_record_id = OLD.id)
      OR (TG_ARGV[0] = 'post' AND source_type = 'comment' AND source_record_id IN (SELECT id FROM quills.post_comments WHERE workspace_id = OLD.workspace_id AND post_id = OLD.id)));
    UPDATE quills.integration_sync_attempts SET result = NULL WHERE workspace_id = OLD.workspace_id AND operation_id IN (
      SELECT id FROM quills.integration_sync_operations WHERE workspace_id = OLD.workspace_id AND ((source_type = TG_ARGV[0] AND source_record_id = OLD.id)
      OR (TG_ARGV[0] = 'post' AND source_type = 'comment' AND source_record_id IN (SELECT id FROM quills.post_comments WHERE workspace_id = OLD.workspace_id AND post_id = OLD.id))));
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE OR REPLACE TRIGGER integration_sync_post_delete AFTER UPDATE OF deleted_at, moderation_state OR DELETE ON quills.posts
  FOR EACH ROW EXECUTE FUNCTION quills.purge_integration_sync_source('post');
--> statement-breakpoint
CREATE OR REPLACE TRIGGER integration_sync_ticket_delete AFTER UPDATE OF deleted_at OR DELETE ON quills.tickets
  FOR EACH ROW EXECUTE FUNCTION quills.purge_integration_sync_source('ticket');
--> statement-breakpoint
CREATE OR REPLACE TRIGGER integration_sync_user_delete AFTER DELETE ON quills.customer_identity
  FOR EACH ROW EXECUTE FUNCTION quills.purge_integration_sync_source('user');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS integration_sync_source_record_idx ON quills.integration_sync_operations (source_type, source_record_id);
--> statement-breakpoint
CREATE OR REPLACE TRIGGER integration_sync_comment_delete AFTER UPDATE OF deleted_at, is_private, moderation_state OR DELETE ON quills.post_comments
  FOR EACH ROW EXECUTE FUNCTION quills.purge_integration_sync_source('comment');
--> statement-breakpoint
CREATE OR REPLACE TRIGGER integration_sync_changelog_delete AFTER UPDATE OF deleted_at, published_at OR DELETE ON quills.changelog_entries
  FOR EACH ROW EXECUTE FUNCTION quills.purge_integration_sync_source('changelog');

--> statement-breakpoint
CREATE OR REPLACE TRIGGER integration_sync_conversation_delete AFTER DELETE ON quills.conversations
  FOR EACH ROW EXECUTE FUNCTION quills.purge_integration_sync_source('conversation');
--> statement-breakpoint
CREATE OR REPLACE TRIGGER integration_sync_message_delete AFTER UPDATE OF deleted_at, is_internal OR DELETE ON quills.conversation_messages
  FOR EACH ROW EXECUTE FUNCTION quills.purge_integration_sync_source('message');

--> statement-breakpoint
CREATE FUNCTION quills.check_customer_membership() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF NEW.kaneo_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.workspace_member WHERE workspace_id=NEW.workspace_id AND user_id=NEW.kaneo_user_id) THEN
    RAISE EXCEPTION 'Kaneo user is not a member of this workspace' USING ERRCODE='23503';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION quills.check_customer_membership() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER customer_membership BEFORE INSERT OR UPDATE OF workspace_id, kaneo_user_id ON quills.customer_identity FOR EACH ROW EXECUTE FUNCTION quills.check_customer_membership();

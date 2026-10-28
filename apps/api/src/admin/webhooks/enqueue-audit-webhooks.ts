import { sql } from "drizzle-orm";
import type { DbOrTx } from "../../project-access/db-or-tx";

/** Runs in the audit transaction: workers cannot see deliveries until commit. */
export async function enqueueAuditWebhooks(database: DbOrTx, auditId: string) {
  await database.execute(sql`
    INSERT INTO instance_webhook_delivery (id, webhook_id, payload)
    SELECT gen_random_uuid()::text, w.id,
      jsonb_build_object(
        'id', a.id, 'action', a.action, 'actorUserId', a.actor_user_id,
        'actorName', a.actor_name, 'actorEmail', a.actor_email,
        'targetType', a.target_type, 'targetId', a.target_id,
        'targetLabel', a.target_label, 'metadata', a.metadata,
        'ipAddress', a.ip_address,
        'createdAt', to_char(a.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
    FROM admin_audit_log a CROSS JOIN instance_webhook w
    WHERE a.id = ${auditId} AND w.enabled
      AND split_part(a.action, '.', 1) = ANY(w.categories)
  `);
}

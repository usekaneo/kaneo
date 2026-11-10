import { sql } from "drizzle-orm";
import type { Database } from "./client";
export async function syncCommentCounts(db: Database): Promise<number> {
  const result = await db.execute(sql`
      UPDATE quills.posts
      SET comment_count = (
        SELECT COUNT(*)::int
        FROM quills.post_comments c
        WHERE c.deleted_at IS NULL
          AND c.is_private = false
          AND c.moderation_state <> 'pending'
          AND c.post_id IN (
            SELECT posts.id
            UNION ALL
            SELECT s.id
            FROM quills.posts s
            INNER JOIN quills.boards b ON b.id = s.board_id
            WHERE s.canonical_post_id = posts.id
              AND s.deleted_at IS NULL
              AND b.deleted_at IS NULL
          )
      )
      WHERE comment_count != (
        SELECT COUNT(*)::int
        FROM quills.post_comments c
        WHERE c.deleted_at IS NULL
          AND c.is_private = false
          AND c.moderation_state <> 'pending'
          AND c.post_id IN (
            SELECT posts.id
            UNION ALL
            SELECT s.id
            FROM quills.posts s
            INNER JOIN quills.boards b ON b.id = s.board_id
            WHERE s.canonical_post_id = posts.id
              AND s.deleted_at IS NULL
              AND b.deleted_at IS NULL
          )
      )
    `);
  return result.rowCount ?? 0;
}

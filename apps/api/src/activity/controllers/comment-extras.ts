import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  activityReactionTable,
  activityTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { publishEvent } from "../../events";

type ActivityRow = typeof activityTable.$inferSelect;

/** A one-line plain-text preview of a markdown comment, for reply quotes. */
export function commentExcerpt(markdown: string | null, max = 140) {
  const text = (markdown ?? "")
    // Mentions are stored as <kaneo-mention …>Name</kaneo-mention>.
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~#>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Comments may only quote other comments on the same task. */
export async function assertReplyTarget(taskId: string, replyToId: string) {
  const [target] = await db
    .select({ id: activityTable.id, userId: activityTable.userId })
    .from(activityTable)
    .where(
      and(
        eq(activityTable.id, replyToId),
        eq(activityTable.taskId, taskId),
        eq(activityTable.type, "comment"),
      ),
    );
  if (!target) {
    throw new HTTPException(400, {
      message: "Replies must quote a comment on the same task",
    });
  }
  return target;
}

/** Adds the quoted comment and grouped reactions to each comment. */
export async function withCommentExtras(activities: ActivityRow[]) {
  const commentIds = activities
    .filter((a) => a.type === "comment")
    .map((a) => a.id);
  const replyIds = [
    ...new Set(
      activities
        .map((a) => a.replyToId)
        .filter((id): id is string => id !== null),
    ),
  ];

  const [quoted, reactions] = await Promise.all([
    replyIds.length > 0
      ? db
          .select({
            id: activityTable.id,
            content: activityTable.content,
            userId: activityTable.userId,
            userName: userTable.name,
            externalUserName: activityTable.externalUserName,
          })
          .from(activityTable)
          .leftJoin(userTable, eq(activityTable.userId, userTable.id))
          .where(inArray(activityTable.id, replyIds))
      : [],
    commentIds.length > 0
      ? db
          .select({
            activityId: activityReactionTable.activityId,
            emoji: activityReactionTable.emoji,
            userId: activityReactionTable.userId,
          })
          .from(activityReactionTable)
          .where(inArray(activityReactionTable.activityId, commentIds))
          .orderBy(activityReactionTable.createdAt)
      : [],
  ]);
  const quotedBy = new Map(quoted.map((q) => [q.id, q]));

  return activities.map((activity) => {
    const grouped = new Map<string, string[]>();
    for (const r of reactions) {
      if (r.activityId !== activity.id) continue;
      grouped.set(r.emoji, [...(grouped.get(r.emoji) ?? []), r.userId]);
    }
    const quote = activity.replyToId ? quotedBy.get(activity.replyToId) : null;
    return {
      ...activity,
      replyTo: quote
        ? {
            id: quote.id,
            userId: quote.userId,
            userName: quote.userName ?? quote.externalUserName,
            excerpt: commentExcerpt(quote.content),
          }
        : null,
      reactions: [...grouped].map(([emoji, userIds]) => ({ emoji, userIds })),
    };
  });
}

/** Adds the caller's reaction to a comment, or takes it back. */
export async function toggleCommentReaction(
  userId: string,
  activityId: string,
  emoji: string,
) {
  const [comment] = await db
    .select()
    .from(activityTable)
    .where(
      and(eq(activityTable.id, activityId), eq(activityTable.type, "comment")),
    );
  if (!comment) {
    throw new HTTPException(404, { message: "Comment not found" });
  }

  const removed = await db
    .delete(activityReactionTable)
    .where(
      and(
        eq(activityReactionTable.activityId, activityId),
        eq(activityReactionTable.userId, userId),
        eq(activityReactionTable.emoji, emoji),
      ),
    )
    .returning({ emoji: activityReactionTable.emoji });
  if (removed.length === 0) {
    await db
      .insert(activityReactionTable)
      .values({ activityId, userId, emoji })
      .onConflictDoNothing();
  }

  const [task] = await db
    .select({ projectId: taskTable.projectId })
    .from(taskTable)
    .where(eq(taskTable.id, comment.taskId));
  // Its own event: integrations listening to comment.updated shouldn't
  // announce a reaction as an edit. The websocket still refreshes the feed.
  if (task) {
    await publishEvent("comment.reacted", {
      taskId: comment.taskId,
      projectId: task.projectId,
      userId,
    });
  }

  const [hydrated] = await withCommentExtras([comment]);
  if (!hydrated) throw new HTTPException(404, { message: "Comment not found" });
  return hydrated;
}

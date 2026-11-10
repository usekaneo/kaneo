import { useState } from "react";
import { CommentThread } from "./CommentThread.js";
import { Composer } from "./Composer.js";
import { emptyDraft, type useDrafts } from "./useDrafts.js";
import type { FeedbackPost, WidgetViewProps } from "./types.js";

export function FeedbackDiscussion({
  post,
  drafts,
  onComment,
  onVote,
  offline,
}: {
  post: FeedbackPost;
  drafts: ReturnType<typeof useDrafts>;
  onComment?: WidgetViewProps["onCommentFeedback"];
  onVote?: WidgetViewProps["onVoteComment"];
  offline: boolean;
}) {
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const comments = post.comments ?? [];
  const draftKey = (parentId: string | null) =>
    `comment:${JSON.stringify([post.id, parentId])}`;
  const composer = (parentId: string | null) => {
    const key = draftKey(parentId);
    return (
      <div className="qb-comment-composer">
        {parentId && (
          <button
            type="button"
            className="qb-text-button"
            onClick={() => setReplyTo(null)}
          >
            Cancel reply
          </button>
        )}
        <Composer
          kind="comment"
          draft={drafts.drafts[key] ?? emptyDraft}
          onChange={(body) => drafts.change(key, body)}
          offline={offline}
          onSubmit={
            onComment
              ? () => {
                  if (offline) return;
                  void drafts.submit(
                    key,
                    (body, options) =>
                      onComment(post.id, body, {
                        ...options,
                        ...(parentId ? { parentId } : {}),
                      }),
                    () => {},
                  );
                }
              : undefined
          }
        />
      </div>
    );
  };
  const ids = new Set(comments.map((comment) => comment.id));
  return (
    <section className="qb-discussion" aria-label="Request discussion">
      {composer(null)}
      {comments
        .filter((comment) => !comment.parentId || !ids.has(comment.parentId))
        .map((comment) => (
          <CommentThread
            key={comment.id}
            comment={comment}
            comments={comments}
            ancestors={[]}
            onReply={(id) => setReplyTo(id)}
            renderReply={(id) => (replyTo === id ? composer(id) : null)}
            onVote={
              onVote ? (id, voted) => onVote(post.id, id, voted) : undefined
            }
            offline={offline}
          />
        ))}
    </section>
  );
}

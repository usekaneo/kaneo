import type { ReactNode } from "react";
import { Avatar } from "./Avatar.js";
import { Icon } from "./Icon.js";
import { relativeTime } from "./relative-time.js";
import { useAction } from "./useAction.js";
import type { FeedbackComment } from "./types.js";

export function CommentThread({
  comment,
  comments,
  ancestors,
  onReply,
  renderReply,
  onVote,
  offline,
}: {
  comment: FeedbackComment;
  comments: readonly FeedbackComment[];
  ancestors: readonly string[];
  onReply: (id: string) => void;
  renderReply: (id: string) => ReactNode;
  onVote?: (id: string, voted: boolean) => Promise<unknown>;
  offline: boolean;
}) {
  const action = useAction();
  const age = relativeTime(comment.createdAt);
  const path = [...ancestors, comment.id];
  return (
    <div className="qb-comment-thread">
      <article
        className="qb-comment"
        aria-label={`Comment by ${comment.author}`}
      >
        <Avatar
          name={comment.author}
          avatarUrl={comment.avatarUrl}
          verified={comment.verified}
        />
        <div className="qb-comment-content">
          <div className="qb-comment-meta">
            <strong>{comment.author}</strong>
            {age && <time dateTime={comment.createdAt}>{age}</time>}
          </div>
          <p>{comment.body}</p>
          <div className="qb-comment-actions">
            <button type="button" onClick={() => onReply(comment.id)}>
              Reply
            </button>
            <button
              type="button"
              className="qb-votes"
              aria-label={`Vote for comment by ${comment.author}`}
              aria-pressed={!!comment.voted}
              disabled={offline || !onVote || action.pending}
              onClick={() => {
                if (onVote)
                  void action.run(() => onVote(comment.id, !comment.voted));
              }}
            >
              <Icon name="up" />
              {comment.votes}
            </button>
          </div>
          {action.error && (
            <p role="alert" className="qb-form-error">
              {action.error}
            </p>
          )}
          {renderReply(comment.id)}
        </div>
      </article>
      <div className="qb-comment-replies" data-indent={ancestors.length < 2}>
        {comments
          .filter(
            (child) =>
              child.parentId === comment.id && !path.includes(child.id),
          )
          .map((child) => (
            <CommentThread
              key={child.id}
              comment={child}
              comments={comments}
              ancestors={path}
              onReply={onReply}
              renderReply={renderReply}
              onVote={onVote}
              offline={offline}
            />
          ))}
      </div>
    </div>
  );
}

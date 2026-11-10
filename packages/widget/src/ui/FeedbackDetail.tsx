import { Icon } from "./Icon.js";
import { Avatar } from "./Avatar.js";
import { AttachmentGallery } from "./AttachmentGallery.js";
import { FeedbackDiscussion } from "./FeedbackDiscussion.js";
import { feedbackStatusLabels } from "./feedback.js";
import { relativeTime } from "./relative-time.js";
import { useAction } from "./useAction.js";
import type { useDrafts } from "./useDrafts.js";
import type { FeedbackPost, WidgetViewProps } from "./types.js";

export function FeedbackDetail({
  post,
  onVote,
  onFollow,
  onComment,
  onVoteComment,
  drafts,
  offline,
}: {
  post: FeedbackPost;
  onVote?: WidgetViewProps["onVoteFeedback"];
  onFollow?: WidgetViewProps["onFollowFeedback"];
  onComment?: WidgetViewProps["onCommentFeedback"];
  onVoteComment?: WidgetViewProps["onVoteComment"];
  drafts: ReturnType<typeof useDrafts>;
  offline: boolean;
}) {
  const action = useAction();
  const age = relativeTime(post.createdAt);
  return (
    <article className="qb-detail qb-request-detail">
      <div className="qb-byline">
        <Avatar
          name={post.author}
          avatarUrl={post.avatarUrl}
          verified={post.verified}
        />
        <div>
          <strong>{post.author}</strong>
          {age && <time dateTime={post.createdAt}>{age}</time>}
        </div>
      </div>
      <h1>{post.title}</h1>
      <p className="qb-request-body">{post.body}</p>
      <AttachmentGallery attachments={post.attachments} />
      <div className="qb-request-summary">
        <span className="qb-request-status" data-status={post.status ?? "open"}>
          <span className="qb-status-dot" />
          {feedbackStatusLabels[post.status ?? "open"]}
        </span>
        <span className="qb-avatar-stack">
          {post.voters?.slice(0, 4).map((person) => (
            <Avatar key={person.name} {...person} />
          ))}
        </span>
        <button
          type="button"
          className="qb-votes"
          aria-label={`${post.voted ? "Voted" : "Vote"} · ${post.votes}`}
          aria-pressed={!!post.voted}
          disabled={!onVote || offline || action.pending}
          onClick={() => {
            if (onVote) void action.run(() => onVote(post.id, !post.voted));
          }}
        >
          <Icon name="up" />
          {post.votes}
        </button>
      </div>
      <button
        type="button"
        className="qb-follow-request"
        aria-pressed={!!post.following}
        disabled={!onFollow || offline || action.pending}
        onClick={() => {
          if (onFollow)
            void action.run(() => onFollow(post.id, !post.following));
        }}
      >
        {post.following ? "Following" : "Follow request"}
      </button>
      {action.error && (
        <p className="qb-form-error" role="alert">
          {action.error}
        </p>
      )}
      <FeedbackDiscussion
        post={post}
        drafts={drafts}
        onComment={onComment}
        onVote={onVoteComment}
        offline={offline}
      />
    </article>
  );
}

import { Avatar } from "./Avatar.js";
import { Icon } from "./Icon.js";
import { feedbackStatusLabels } from "./feedback.js";
import type { FeedbackPost, FeedbackStatus } from "./types.js";

export function RoadmapView({
  posts,
  onOpen,
  expanded,
  onExpanded,
}: {
  posts: readonly FeedbackPost[];
  onOpen: (id: string) => void;
  expanded: readonly FeedbackStatus[];
  onExpanded: (statuses: readonly FeedbackStatus[]) => void;
}) {
  const groups = ["in_progress", "planned", "shipped"] as const;
  return (
    <div className="qb-roadmap">
      {groups.map((status) => {
        const items = posts.filter((post) => post.status === status);
        if (!items.length) return null;
        return (
          <section
            className="qb-roadmap-group"
            data-status={status}
            key={status}
          >
            <h2>
              {feedbackStatusLabels[status]}
              <span className="qb-status-dot" />
            </h2>
            {(expanded.includes(status) ? items : items.slice(0, 3)).map(
              (post) => (
                <button
                  type="button"
                  className="qb-roadmap-item"
                  key={post.id}
                  onClick={() => onOpen(post.id)}
                >
                  <span className="qb-feedback-copy">
                    <strong>{post.title}</strong>
                    <span>{post.body}</span>
                    <small>
                      <Avatar name={post.author} avatarUrl={post.avatarUrl} />
                      {post.author}
                    </small>
                  </span>
                  <span className="qb-votes">
                    <Icon name="up" />
                    {post.votes}
                  </span>
                </button>
              ),
            )}
            {items.length > 3 && (
              <button
                type="button"
                className="qb-roadmap-more"
                aria-expanded={expanded.includes(status)}
                onClick={() =>
                  onExpanded(
                    expanded.includes(status)
                      ? expanded.filter((value) => value !== status)
                      : [...expanded, status],
                  )
                }
              >
                {expanded.includes(status) ? "Show less" : "Show more"}
                <Icon name="down" />
              </button>
            )}
          </section>
        );
      })}
      {!posts.some((post) => post.status && post.status !== "open") && (
        <p className="qb-empty">No roadmap items yet.</p>
      )}
    </div>
  );
}

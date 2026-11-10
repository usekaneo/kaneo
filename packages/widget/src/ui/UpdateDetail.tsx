import { Avatar } from "./Avatar.js";
import { RichContent } from "./RichContent.js";
import { UpdateActions } from "./UpdateActions.js";
import type { FeedbackPost, UpdateEntry, WidgetViewProps } from "./types.js";

export function UpdateDetail({
  entry,
  posts,
  onOpenPost,
  onReact,
  onShare,
}: {
  entry: UpdateEntry;
  posts: readonly FeedbackPost[];
  onOpenPost: (id: string) => void;
  onReact?: WidgetViewProps["onReactToUpdate"];
  onShare?: WidgetViewProps["onShareUpdate"];
}) {
  const related = (entry.relatedPostIds ?? []).flatMap((id) =>
    posts.filter((post) => post.id === id),
  );
  return (
    <article className="qb-detail qb-reader qb-update-detail">
      <span className="qb-date">{entry.date}</span>
      <h1>{entry.title}</h1>
      <RichContent body={entry.body} blocks={entry.blocks} />
      <div className="qb-byline">
        <Avatar name={entry.author} avatarUrl={entry.avatarUrl} />
        <div>
          <strong>{entry.author}</strong>
          {entry.authorRole && <span>{entry.authorRole}</span>}
        </div>
      </div>
      <UpdateActions entry={entry} onReact={onReact} onShare={onShare} />
      {!!related.length && (
        <section className="qb-linked-requests">
          <h2>From the board</h2>
          {entry.requesterCount !== undefined && (
            <p>{entry.requesterCount} people asked for this</p>
          )}
          {related.map((post) => (
            <button
              className="qb-linked-request"
              type="button"
              key={post.id}
              onClick={() => onOpenPost(post.id)}
            >
              <span>{post.title}</span>
              <span className="qb-avatar-stack">
                {post.voters?.slice(0, 3).map((person) => (
                  <Avatar key={person.name} {...person} />
                ))}
              </span>
            </button>
          ))}
        </section>
      )}
    </article>
  );
}

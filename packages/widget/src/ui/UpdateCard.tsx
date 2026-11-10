import type { UpdateEntry } from "./types.js";

export function UpdateCard({
  entry,
  onOpen,
}: {
  entry: UpdateEntry;
  onOpen?: () => void;
}) {
  const content = (
    <>
      <span className="qb-date">
        {entry.date}
        {entry.unread && <span className="qb-new-label">New</span>}
      </span>
      <h2>{entry.title}</h2>
      <p>{entry.body}</p>
      <span className="qb-author">
        <span className="qb-avatar">{entry.author.slice(0, 1)}</span>
        <span>
          {entry.author}
          <small>Team</small>
        </span>
      </span>
    </>
  );
  return onOpen ? (
    <button type="button" className="qb-update-card" onClick={onOpen}>
      {content}
    </button>
  ) : (
    <article className="qb-update-card qb-update-full">{content}</article>
  );
}

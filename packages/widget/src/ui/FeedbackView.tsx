import { useRef } from "react";
import { Icon } from "./Icon.js";
import { SearchField } from "./SearchField.js";
import { feedbackStatusLabels } from "./feedback.js";
import { RoadmapView } from "./RoadmapView.js";
import type { FeedbackPost, FeedbackFilters } from "./types.js";

export function FeedbackView({
  posts,
  onOpen,
  onCompose,
  filters,
  onFilters,
}: {
  posts: readonly FeedbackPost[];
  onOpen: (id: string) => void;
  onCompose: () => void;
  filters: FeedbackFilters;
  onFilters: (filters: FeedbackFilters) => void;
}) {
  const { query, sort, status } = filters;
  const search = useRef<HTMLInputElement>(null);
  const term = query.trim().toLowerCase();
  const filtered = posts.filter(
    (post) =>
      (status === "all" || (post.status ?? "open") === status) &&
      `${post.title} ${post.body}`.toLowerCase().includes(term),
  );
  if (sort === "votes") filtered.sort((a, b) => b.votes - a.votes);
  else if (sort === "title")
    filtered.sort((a, b) => a.title.localeCompare(b.title));
  return (
    <div className="qb-list-view">
      <div className="qb-title-row">
        <h1>{sort === "roadmap" ? "Roadmap" : "Feedback"}</h1>
        <label
          className="qb-sort"
          data-active={sort !== "default"}
          title={
            sort === "votes"
              ? "Sorted by most votes"
              : sort === "title"
                ? "Sorted by title"
                : "Sort feedback"
          }
        >
          <Icon name="filter" />
          <select
            aria-label="Sort feedback"
            value={sort}
            onChange={(event) =>
              onFilters({ ...filters, sort: event.target.value })
            }
          >
            <option value="default">Default order</option>
            <option value="votes">Most votes</option>
            <option value="title">Title</option>
            <option value="roadmap">Roadmap</option>
          </select>
        </label>
      </div>
      {sort === "roadmap" ? (
        <RoadmapView
          posts={posts}
          onOpen={onOpen}
          expanded={filters.roadmapExpanded ?? []}
          onExpanded={(roadmapExpanded) =>
            onFilters({ ...filters, roadmapExpanded })
          }
        />
      ) : (
        <>
          <SearchField
            label="Search feedback"
            value={query}
            onChange={(query) => onFilters({ ...filters, query })}
            inputRef={search}
          />
          <div
            className="qb-status-filters"
            role="group"
            aria-label="Feedback status"
          >
            {(
              ["all", "open", "planned", "in_progress", "shipped"] as const
            ).map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={status === value}
                onClick={() => onFilters({ ...filters, status: value })}
              >
                {value === "all" ? "All" : feedbackStatusLabels[value]}
              </button>
            ))}
          </div>
          <div className="qb-feedback-list">
            {filtered.map((post) => (
              <button
                type="button"
                key={post.id}
                className="qb-feedback-row"
                onClick={() => onOpen(post.id)}
              >
                <span className="qb-avatar">{post.author.slice(0, 1)}</span>
                <span className="qb-feedback-copy">
                  <strong>{post.title}</strong>
                  <span>{post.body}</span>
                  <small>
                    {post.author}
                    {post.status && <> · {feedbackStatusLabels[post.status]}</>}
                    {post.following && " · Following"}
                  </small>
                </span>
                <span className="qb-votes" aria-label={`${post.votes} votes`}>
                  <Icon name="up" />
                  {post.votes}
                </span>
              </button>
            ))}
          </div>
          {!filtered.length && (
            <div className="qb-empty" role={term ? "status" : undefined}>
              <span className="qb-empty-icon">
                <Icon name={term ? "search" : "feedback"} />
              </span>
              <h2>
                {term
                  ? "No feedback matches your search."
                  : "Be the first to share an idea."}
              </h2>
              <p>
                {term
                  ? "Try another word or clear your search."
                  : "Have something in mind? Submit your feedback below."}
              </p>
            </div>
          )}
        </>
      )}
      {sort !== "roadmap" && (
        <div className="qb-floating-action">
          <button type="button" className="qb-primary" onClick={onCompose}>
            <Icon name="plus" />
            Submit feedback
          </button>
        </div>
      )}
    </div>
  );
}

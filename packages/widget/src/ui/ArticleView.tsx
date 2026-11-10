import { Avatar } from "./Avatar.js";
import { RichContent } from "./RichContent.js";
import { messageTime } from "./message-time.js";
import { useAction } from "./useAction.js";
import type { HelpArticle, WidgetViewProps } from "./types.js";

export function ArticleView({
  article,
  articles,
  onOpen,
  onFeedback,
  onContact,
  offline,
}: {
  article: HelpArticle;
  articles: readonly HelpArticle[];
  onOpen: (id: string) => void;
  onFeedback?: WidgetViewProps["onArticleFeedback"];
  onContact?: () => void;
  offline: boolean;
}) {
  const action = useAction();
  const state = action.forKey(article.id);
  const related = articles
    .filter(
      (item) => item.id !== article.id && item.category === article.category,
    )
    .slice(0, 3);
  const stamp = messageTime(article.updatedAt);
  return (
    <article className="qb-detail qb-article qb-reader">
      <h1>{article.title}</h1>
      {article.author && (
        <div className="qb-byline">
          <Avatar {...article.author} />
          <div>
            <strong>{article.author.name}</strong>
            {stamp && (
              <span>
                Updated <time dateTime={stamp.iso}>{stamp.day}</time>
              </span>
            )}
          </div>
        </div>
      )}
      <RichContent body={article.body} blocks={article.blocks} />
      {(onFeedback || onContact) && (
        <section className="qb-article-feedback" aria-label="Article feedback">
          {onFeedback && (
            <>
              <h2>Was this helpful?</h2>
              <div className="qb-helpful-actions">
                {[true, false].map((helpful) => (
                  <button
                    key={String(helpful)}
                    type="button"
                    aria-pressed={article.helpful === helpful}
                    disabled={offline || state.pending}
                    onClick={() =>
                      void action.run(
                        () => onFeedback(article.id, helpful),
                        article.id,
                      )
                    }
                  >
                    {helpful ? "Yes" : "No"}
                  </button>
                ))}
              </div>
              <p role="status">
                {state.pending
                  ? "Saving your feedback…"
                  : article.helpful !== undefined
                    ? "Thanks for your feedback."
                    : ""}
              </p>
              {state.error && (
                <p className="qb-form-error" role="alert">
                  {state.error}
                </p>
              )}
            </>
          )}
          {onContact && (
            <button
              type="button"
              className="qb-text-button"
              onClick={onContact}
            >
              Still need help? Send a message
            </button>
          )}
        </section>
      )}
      {related.length > 0 && (
        <section className="qb-related">
          <h2>Related articles</h2>
          {related.map((item) => (
            <button
              type="button"
              className="qb-help-row"
              key={item.id}
              onClick={() => onOpen(item.id)}
            >
              {item.title}
            </button>
          ))}
        </section>
      )}
    </article>
  );
}

import type { HelpArticle, FeedbackPost } from "./types.js";

export function articleText(article: HelpArticle) {
  return article.blocks?.length
    ? article.blocks
        .map((block) =>
          block.type === "list" ? block.items.join(" ") : block.text,
        )
        .join(" ")
    : article.body;
}

function rankArticles(
  articles: readonly HelpArticle[],
  terms: readonly string[],
) {
  return articles
    .map((article) => {
      const title = article.title.toLowerCase();
      const body = articleText(article).toLowerCase();
      const group = article.category.toLowerCase();
      const matches = terms.every((term) =>
        `${title} ${group} ${body}`.includes(term),
      );
      const score = terms.reduce(
        (sum, term) =>
          sum +
          (title.includes(term)
            ? 4
            : group.includes(term)
              ? 2
              : body.includes(term)
                ? 1
                : 0),
        0,
      );
      return { article, matches, score };
    })
    .sort((a, b) => b.score - a.score);
}

export function searchArticles(
  articles: readonly HelpArticle[],
  query: string,
  category: string | null = null,
) {
  const terms = [
    ...new Set(query.trim().toLowerCase().split(/\s+/).filter(Boolean)),
  ];
  return rankArticles(
    articles.filter((article) => !category || article.category === category),
    terms,
  )
    .filter((item) => item.matches)
    .map((item) => item.article);
}

/** Suggestions match useful words in a question; explicit search requires every term. */
function suggestionTerms(draft: string) {
  return [
    ...new Set(draft.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []),
  ].filter(
    (term) =>
      !/^(the|and|for|with|this|that|how|can|you|your|could|would|please|what|does|have|from|about|need|help)$/.test(
        term,
      ),
  );
}
export function suggestArticles(
  articles: readonly HelpArticle[],
  draft: string,
) {
  const terms = suggestionTerms(draft);
  return rankArticles(articles, terms)
    .filter((item) => item.score > 0)
    .slice(0, 3)
    .map((item) => item.article);
}

export function suggestFeedback(posts: readonly FeedbackPost[], draft: string) {
  const terms = suggestionTerms(draft);
  return posts
    .map((post) => ({
      post,
      score: terms.reduce(
        (sum, term) =>
          sum +
          (post.title.toLowerCase().includes(term)
            ? 3
            : post.body.toLowerCase().includes(term)
              ? 1
              : 0),
        0,
      ),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.post);
}

export function articleExcerpt(body: string, query: string) {
  const text = body.replace(/\s+/g, " ");
  const term = query.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const start = Math.max(0, text.toLowerCase().indexOf(term) - 36);
  return `${start ? "…" : ""}${text.slice(start, start + 140)}${text.length > start + 140 ? "…" : ""}`;
}

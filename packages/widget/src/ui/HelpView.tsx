import { useRef } from "react";
import { Icon } from "./Icon.js";
import { SearchField } from "./SearchField.js";
import { searchArticles, articleExcerpt, articleText } from "./search.js";
import { HighlightedText } from "./HighlightedText.js";
import type { HelpArticle, HelpFilters } from "./types.js";

export function HelpView({
  articles,
  onOpen,
  filters,
  onFilters,
}: {
  articles: readonly HelpArticle[];
  onOpen: (id: string) => void;
  filters: HelpFilters;
  onFilters: (filters: HelpFilters) => void;
}) {
  const { query, category } = filters;
  const search = useRef<HTMLInputElement>(null);
  const term = query.trim().toLowerCase();
  const categories = [...new Set(articles.map((article) => article.category))];
  const filtered = searchArticles(articles, query, category);
  return (
    <div className="qb-list-view">
      <h1>Help &amp; Support</h1>
      <SearchField
        label="Search for help"
        value={query}
        onChange={(query) => onFilters({ ...filters, query })}
        inputRef={search}
      />
      {category && (
        <button
          type="button"
          className="qb-category-back"
          onClick={() => {
            onFilters({ ...filters, category: null });
            search.current?.focus();
          }}
        >
          <Icon name="back" />
          All categories
        </button>
      )}
      {!term && !category
        ? categories.map((name) => (
            <button
              type="button"
              className="qb-help-row"
              key={name}
              onClick={() => {
                onFilters({ ...filters, category: name });
                search.current?.focus();
              }}
            >
              <span className="qb-category-icon">
                <Icon name="folder" />
              </span>
              <span>{name}</span>
              <small>
                {articles.filter((article) => article.category === name).length}
              </small>
              <Icon name="chevron" />
            </button>
          ))
        : filtered.map((article) => (
            <button
              type="button"
              className="qb-help-row"
              key={article.id}
              onClick={() => onOpen(article.id)}
            >
              <span className="qb-category-icon">
                <Icon name="help" />
              </span>
              <span>
                <HighlightedText text={article.title} query={query} />
                {term && (
                  <small className="qb-search-excerpt">
                    <HighlightedText
                      text={articleExcerpt(articleText(article), query)}
                      query={query}
                    />
                  </small>
                )}
              </span>
              <Icon name="chevron" />
            </button>
          ))}
      {!filtered.length && (
        <div className="qb-empty" role={term ? "status" : undefined}>
          <span className="qb-empty-icon">
            <Icon name={term ? "search" : "help"} />
          </span>
          <h2>
            {term ? "No articles match your search." : "No help articles yet."}
          </h2>
          <p>
            {term
              ? "Try another word or clear your search."
              : "Check back here for guides and answers."}
          </p>
        </div>
      )}
    </div>
  );
}

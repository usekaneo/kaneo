import { afterEach, describe, expect, it } from "vite-plus/test";
import { cleanup, render } from "@testing-library/react";
import {
  searchArticles,
  suggestArticles,
  articleText,
  articleExcerpt,
} from "../src/ui/search.js";
import { HighlightedText } from "../src/ui/HighlightedText.js";
import { messageTime } from "../src/ui/message-time.js";

afterEach(cleanup);
describe("help search", () => {
  const articles = [
    {
      id: "body",
      title: "Basics",
      category: "Help",
      body: "Vote for feedback.",
    },
    {
      id: "title",
      title: "Vote for feedback",
      category: "Help",
      body: "Choose an idea.",
    },
    {
      id: "other",
      title: "Vote for feedback",
      category: "Other",
      body: "Elsewhere.",
    },
  ];
  it("ranks title matches first, requires all terms, and respects the category", () => {
    expect(
      searchArticles(articles, "  FEEDBACK vote ", "Help").map(
        (item) => item.id,
      ),
    ).toEqual(["title", "body"]);
    expect(searchArticles(articles, "vote missing")).toEqual([]);
    expect(searchArticles(articles, "")).toEqual(articles);
  });
  it("suggests relevant articles from a question without treating filler words as search constraints", () => {
    expect(
      suggestArticles(articles, "How can I vote for feedback please?").map(
        (item) => item.id,
      ),
    ).toEqual(["title", "other", "body"]);
    expect(suggestArticles(articles, "How can you help?")).toEqual([]);
  });
  it("searches the rendered rich article content", () => {
    const article = {
      ...articles[0],
      blocks: [
        { type: "list" as const, items: ["Unique instruction", "Second step"] },
      ],
    };
    expect(articleText(article)).toBe("Unique instruction Second step");
    expect(searchArticles([article], "unique instruction")).toEqual([article]);
    const fallback = {
      ...article,
      blocks: [],
      body: "Unique recovery instructions",
    };
    expect(articleText(fallback)).toBe(fallback.body);
    expect(searchArticles([fallback], "recovery")).toEqual([fallback]);
    expect(
      suggestArticles([fallback], "How can I find recovery instructions?"),
    ).toEqual([fallback]);
  });
  it.each(["[.*]", "a+b", "<script>", "(test)"])(
    "highlights literal %s without regex or HTML interpretation",
    (query) => {
      const { container } = render(
        <HighlightedText
          text={`Before ${query} after ${query}`}
          query={query}
        />,
      );
      expect(container.querySelectorAll("mark")).toHaveLength(2);
      expect(container.querySelector("script")).toBeNull();
      expect(container.textContent).toBe(`Before ${query} after ${query}`);
    },
  );
  it("extracts a bounded snippet around a match", () => {
    const excerpt = articleExcerpt(
      `${"before ".repeat(50)}needle ${"after ".repeat(50)}`,
      "needle",
    );
    expect(excerpt).toContain("needle");
    expect(excerpt.length).toBeLessThanOrEqual(142);
  });
  it("omits invalid timestamps instead of displaying Invalid Date", () => {
    expect(messageTime("bad")).toBeUndefined();
    expect(messageTime()).toBeUndefined();
    expect(messageTime("2026-11-09T10:00:00Z")?.iso).toBe(
      "2026-11-09T10:00:00.000Z",
    );
  });
});

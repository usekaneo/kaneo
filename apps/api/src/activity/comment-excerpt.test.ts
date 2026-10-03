import { describe, expect, it } from "vite-plus/test";
import { commentExcerpt } from "./comment-excerpt";

describe("commentExcerpt", () => {
  it("keeps short plain text as it is", () => {
    expect(commentExcerpt("Looks good to me")).toBe("Looks good to me");
  });

  it("drops editor tags and keeps the text inside them", () => {
    expect(
      commentExcerpt(
        'Thanks <kaneo-mention id="user-1">@Mira</kaneo-mention>,\n\nshipping today',
      ),
    ).toBe("Thanks @Mira , shipping today");
  });

  it("removes images and keeps link text", () => {
    expect(
      commentExcerpt(
        "See ![shot](https://x.test/a.png) and [the docs](https://x.test)",
      ),
    ).toBe("See and the docs");
  });

  it("truncates long comments", () => {
    const excerpt = commentExcerpt("a".repeat(500));
    expect(excerpt).toHaveLength(240);
    expect(excerpt?.endsWith("…")).toBe(true);
  });

  it("keeps surrogate pairs intact at the excerpt boundary", () => {
    const prefix = "a".repeat(238);
    expect(commentExcerpt(`${prefix}😀tail`)).toBe(`${prefix}😀…`);
    const atLimit = "😀".repeat(240);
    expect(commentExcerpt(atLimit)).toBe(atLimit);
  });

  it("returns null when nothing readable is left", () => {
    expect(commentExcerpt(null)).toBeNull();
    expect(commentExcerpt("![only](https://x.test/a.png)")).toBeNull();
  });
});

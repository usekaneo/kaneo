import { describe, expect, it } from "vitest";
import {
  parseHtml,
  youtubeIdOf,
} from "../../../apps/api/src/link-preview/fetch-preview";

describe("youtubeIdOf", () => {
  it.each([
    ["https://www.youtube.com/watch?v=Lo4_K4relMg&list=x", "Lo4_K4relMg"],
    ["https://youtu.be/Lo4_K4relMg?t=3", "Lo4_K4relMg"],
    ["https://m.youtube.com/shorts/Lo4_K4relMg", "Lo4_K4relMg"],
    ["https://example.com/watch?v=Lo4_K4relMg", null],
    ["https://www.youtube.com/watch?v=bad<id>", null],
  ])("%s", (url, id) => {
    expect(youtubeIdOf(new URL(url))).toBe(id);
  });
});

describe("parseHtml", () => {
  it("prefers Open Graph, decodes entities, and resolves relative URLs", () => {
    const html = `<html><head>
      <title>Fallback</title>
      <meta property="og:title" content="Tom &amp; Jerry">
      <meta name="description" content="Plain description">
      <meta property="og:image" content="/img/card.png">
      <link rel="icon" href="/favicon.png">
    </head><body><meta property="og:title" content="Ignored"></body></html>`;
    expect(parseHtml(html, "https://example.com/post/1")).toEqual({
      title: "Tom & Jerry",
      description: "Plain description",
      image: "https://example.com/img/card.png",
      siteName: null,
      favicon: "https://example.com/favicon.png",
    });
  });

  it("drops images that aren't http(s)", () => {
    const html = `<head><meta property="og:image" content="javascript:alert(1)"><title>x</title></head>`;
    expect(parseHtml(html, "https://example.com").image).toBeNull();
  });
});

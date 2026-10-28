import { describe, expect, it } from "vite-plus/test";
import { extractImages } from "./extract-images.js";

describe("extractImages", () => {
  it("finds Markdown images with titles and escaped alt text", () => {
    expect(
      extractImages(
        'Intro ![Login \\[old\\] page](/api/asset/a1 "Before") and ![](https://cdn.test/b.png)',
      ),
    ).toEqual([
      { url: "/api/asset/a1", alt: "Login [old] page" },
      { url: "https://cdn.test/b.png", alt: "" },
    ]);
  });

  it("reads angle bracket destinations and balanced parentheses", () => {
    expect(
      extractImages(
        "![a](<https://cdn.test/my shot.png>) ![b](https://cdn.test/x_(1).png)",
      ),
    ).toEqual([
      { url: "https://cdn.test/my shot.png", alt: "a" },
      { url: "https://cdn.test/x_(1).png", alt: "b" },
    ]);
  });

  it("finds resized images written as img tags", () => {
    expect(
      extractImages(
        '<img src="/api/asset/a1" alt="Tom &amp; Jerry" width="320" />\n<img alt=\'x\' src=\'https://cdn.test/c.png\'>',
      ),
    ).toEqual([
      { url: "/api/asset/a1", alt: "Tom & Jerry" },
      { url: "https://cdn.test/c.png", alt: "x" },
    ]);
  });

  it("includes image attachments and skips other files", () => {
    expect(
      extractImages(
        [
          '<kaneo-attachment url="http://localhost:1337/api/asset/p1" filename="spec.pdf" mime-type="application/pdf" size="10" />',
          '<kaneo-attachment url="http://localhost:1337/api/asset/i1" filename="diagram.png" mime-type="image/png" size="20" />',
          '<kaneo-attachment url="http://localhost:1337/api/asset/i2" filename="photo.JPG" />',
        ].join("\n"),
      ),
    ).toEqual([
      { url: "http://localhost:1337/api/asset/i1", alt: "diagram.png" },
      { url: "http://localhost:1337/api/asset/i2", alt: "photo.JPG" },
    ]);
  });

  it("keeps document order across syntaxes", () => {
    expect(
      extractImages(
        '<img src="/api/asset/1">\n\n![two](/api/asset/2)\n\n<kaneo-attachment url="/api/asset/3" filename="3.png" mime-type="image/png" />',
      ).map((image) => image.url),
    ).toEqual(["/api/asset/1", "/api/asset/2", "/api/asset/3"]);
  });

  it("ignores code, comments, duplicates and unusable links", () => {
    const markdown = [
      "```md",
      "![in a fence](/api/asset/fenced)",
      "```",
      "Inline `![code](/api/asset/code)` stays text.",
      "<!-- ![hidden](/api/asset/hidden) -->",
      "![dup](/api/asset/1) ![dup again](/api/asset/1)",
      "![data](data:image/png;base64,AAAA) ![js](javascript:alert(1))",
    ].join("\n");
    expect(extractImages(markdown)).toEqual([
      { url: "/api/asset/1", alt: "dup" },
    ]);
  });

  it("returns nothing for text without images", () => {
    expect(extractImages("Just [a link](https://kaneo.app).")).toEqual([]);
  });
});

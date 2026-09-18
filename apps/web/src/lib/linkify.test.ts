import { describe, expect, it } from "vitest";
import { linkify, linksIn } from "./linkify";

describe("linkify", () => {
  it("links http, https and www, leaving the rest as text", () => {
    expect(linkify("see https://a.com/x?y=1, and www.b.org.")).toEqual([
      { type: "text", value: "see " },
      {
        type: "link",
        value: "https://a.com/x?y=1",
        href: "https://a.com/x?y=1",
      },
      { type: "text", value: ", and " },
      { type: "link", value: "www.b.org", href: "https://www.b.org/" },
      { type: "text", value: "." },
    ]);
  });

  it("never links other schemes", () => {
    expect(linkify("javascript:alert(1) data:text/html,x")).toEqual([
      { type: "text", value: "javascript:alert(1) data:text/html,x" },
    ]);
  });

  it("keeps the whole YouTube link with its query", () => {
    const url =
      "http://youtube.com/watch?v=Lo4_K4relMg&list=RDx6_mbnsh6VU&index=9";
    expect(linksIn(`${url}`)).toEqual([url]);
  });

  it("returns each link once, at most three", () => {
    expect(
      linksIn(
        "https://a.com https://a.com https://b.com https://c.com https://d.com",
      ),
    ).toEqual(["https://a.com/", "https://b.com/", "https://c.com/"]);
  });
});

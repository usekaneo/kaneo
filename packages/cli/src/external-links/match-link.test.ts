import { describe, expect, it } from "vite-plus/test";
import { matchLink } from "./match-link.js";
import { externalLink } from "./test-links.js";

const links = [
  externalLink({ id: "abcd1234xyz", url: "https://example.com/spec" }),
  externalLink({ id: "abce9876xyz", url: "https://example.com/plan" }),
];

describe("matchLink", () => {
  it("finds a link by id, unique id prefix or URL", () => {
    expect(matchLink(links, "abcd1234xyz")).toMatchObject({ kind: "found" });
    expect(matchLink(links, "abcd")).toMatchObject({
      kind: "found",
      link: { id: "abcd1234xyz" },
    });
    expect(matchLink(links, "https://example.com/plan")).toMatchObject({
      kind: "found",
      link: { id: "abce9876xyz" },
    });
  });

  it("reports a shared prefix and refuses very short ones", () => {
    expect(matchLink(links, "abc").kind).toBe("none");
    expect(
      matchLink([...links, externalLink({ id: "abcd5555" })], "abcd").kind,
    ).toBe("ambiguous");
    expect(matchLink(links, "zzzz").kind).toBe("none");
  });
});
